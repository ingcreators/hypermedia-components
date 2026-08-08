// csv-import — recipes/csv-import/contract.md
//
//   POST /imports  (multipart/form-data, file field: csv)
//     → 200 htmx: the validation report fragment — summary line +
//       error table (real <table>: Row / Field / Message) + the
//       confirm form with the hidden token — when importable rows
//       exist; nothing is imported yet
//     → 422: nothing valid / unreadable file — the error report (or
//       the file-level error line), NO confirm form
//     → no-JS: the same report as a full page (real apps 303 to
//       /imports/<token> — PRG — since they hold the batch server-side)
//   POST /imports/<token>/commit
//     → 200: the result summary + `HX-Trigger` with an hc:toast AND an
//       items:changed domain event (the data-region pairing)
//     → 409: expired/consumed token — the re-upload hint fragment
//       (tokens are single-shot; rides the consolidated [401,409,422]
//       beforeSwap allowance)
//     → no-JS: the same outcomes as full pages
//
// Expected CSV: two columns `name,qty` (a leading `name,qty` header row
// is skipped); a row is invalid when it has the wrong field count, the
// name is empty, or qty is not a positive integer. The parser is the
// plan's tiny strict one — comma, "quoted" fields with "" escapes,
// \r\n? rows; real apps bring their own.
//
// Stateless demo trick: a real app holds the parsed batch server-side
// and the token merely references it. This demo has no storage, so the
// token IS the batch — base64url of the valid rows re-serialized as
// CSV. That also means the demo cannot consume tokens; the single-shot
// 409 branch answers any token that does not decode, plus the canned
// token "expired" the fixture and docs use to demonstrate it.

import { DOCS_BASE, escapeHtml, html, hxTrigger, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/csv-import`;
const REPORT_ID = 'csv-import-demo-report';

/**
 * Tiny strict CSV parser: comma-separated, `"quoted"` fields with
 * `""` escapes, `\r\n` or `\n` row endings. Returns an array of rows
 * (arrays of string fields); blank lines are dropped.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** Validate parsed rows → { valid: [{name, qty}], errors: [{row, field, message}] }.
 * `row` is the 1-based CSV line number (header included in the count). */
export function validateRows(rows) {
  const valid = [];
  const errors = [];
  const [first] = rows;
  const hasHeader =
    first?.length === 2 &&
    first[0].trim().toLowerCase() === 'name' &&
    first[1].trim().toLowerCase() === 'qty';
  for (let i = hasHeader ? 1 : 0; i < rows.length; i += 1) {
    const line = i + 1;
    const r = rows[i];
    if (r.length !== 2) {
      errors.push({ row: line, field: 'row', message: `expected 2 fields, got ${r.length}` });
      continue;
    }
    const name = r[0].trim();
    const qty = r[1].trim();
    if (!name) {
      errors.push({ row: line, field: 'name', message: 'name is required' });
      continue;
    }
    if (!/^\d+$/.test(qty) || Number.parseInt(qty, 10) < 1) {
      errors.push({ row: line, field: 'qty', message: 'qty must be a positive integer' });
      continue;
    }
    valid.push({ name, qty: Number.parseInt(qty, 10) });
  }
  return { valid, errors };
}

/** base64url of a UTF-8 string (btoa is latin-1-only, so via bytes). */
function encodeToken(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Inverse of encodeToken; returns null for anything undecodable. */
function decodeToken(token) {
  try {
    const b64 = token.replaceAll('-', '+').replaceAll('_', '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

const csvField = (v) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

function errorTable(errors) {
  const body = errors
    .map(
      ({ row, field, message }) =>
        `      <tr>
        <th scope="row">${row}</th>
        <td>${escapeHtml(field)}</td>
        <td>${escapeHtml(message)}</td>
      </tr>`,
    )
    .join('\n');
  return `<table class="hc-table">
    <caption>Rows that will not be imported</caption>
    <thead>
      <tr>
        <th scope="col">Row</th>
        <th scope="col">Field</th>
        <th scope="col">Message</th>
      </tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>`;
}

function confirmForm(valid) {
  const token = encodeToken(valid.map((r) => `${csvField(r.name)},${r.qty}`).join('\n'));
  const url = `${API}/imports/${token}/commit`;
  const label = `Import the valid ${valid.length} ${valid.length === 1 ? 'row' : 'rows'}`;
  return `<form method="post" action="${url}" data-hx-post="${url}" data-hx-target="#${REPORT_ID}" data-hx-disabled-elt="find button[type=submit]">
    <input type="hidden" name="token" value="${token}">
    <button class="hc-button" data-variant="primary" type="submit">${label}</button>
  </form>`;
}

/** The phase-1 report fragment (the report slot's innerHTML). */
function reportFragment(valid, errors) {
  const parts = [];
  if (errors.length === 0) {
    parts.push(`<p>${valid.length} ${valid.length === 1 ? 'row' : 'rows'} ready to import.</p>`);
  } else {
    parts.push(
      `<p>${valid.length} of ${valid.length + errors.length} rows ready — ${errors.length} ${errors.length === 1 ? 'row has' : 'rows have'} errors and will be skipped.</p>`,
    );
    parts.push(errorTable(errors));
  }
  if (valid.length > 0) parts.push(confirmForm(valid));
  return parts.join('\n');
}

export async function handle({ method, path, request }) {
  if (method === 'POST' && path === '/imports') {
    const data = await request.formData();
    const csv = data.get('csv');
    const answer = (fragment, status) =>
      isHtmx(request)
        ? html(fragment, { status })
        : page('CSV import report', fragment, { status });

    if (!(csv instanceof File) || csv.name === '') {
      return answer('<p class="hc-field__message">A CSV file is required.</p>', 422);
    }
    const rows = parseCsv(await csv.text());
    if (rows.length === 0) {
      return answer(
        `<p class="hc-field__message">${escapeHtml(csv.name)} has no data rows.</p>`,
        422,
      );
    }
    const { valid, errors } = validateRows(rows);
    // Importable rows → 200 report + confirm form; nothing valid → 422
    // report with no form. Either way NOTHING is imported yet.
    return answer(reportFragment(valid, errors), valid.length > 0 ? 200 : 422);
  }

  const commit = method === 'POST' && path.match(/^\/imports\/([^/]+)\/commit$/);
  if (commit) {
    const token = commit[1];
    const batch = token === 'expired' ? null : decodeToken(token);
    const answer = (fragment, { status = 200, headers } = {}) =>
      isHtmx(request)
        ? html(fragment, { status, headers })
        : page('CSV import result', fragment, { status, headers });

    if (batch === null || parseCsv(batch).length === 0) {
      // Single-shot tokens: consumed/expired/undecodable → 409 + the
      // re-upload hint. The fix is always a fresh upload.
      return answer(
        '<p class="hc-field__message">This import was already committed or has expired — upload the file again for a fresh report.</p>',
        { status: 409 },
      );
    }

    const n = parseCsv(batch).length;
    return answer(`<p>${n} ${n === 1 ? 'row' : 'rows'} imported.</p>`, {
      headers: {
        'HX-Trigger': hxTrigger({
          'hc:toast': { message: `${n} rows imported`, variant: 'success' },
          'items:changed': {},
        }),
      },
    });
  }

  return null;
}
