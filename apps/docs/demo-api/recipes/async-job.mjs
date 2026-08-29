// async-job — recipes/async-job/contract.md
//
//   POST /exports                → 202 + the running card (fail=1 for
//                                  the failing flavour)
//   GET  /exports/<id>           → 200 + the current card
//   POST /exports/<id>/cancel    → 200 + the cancelled card (no-op OK)
//   GET  /exports/<id>/result    → the CSV artifact (attachment)
//
// Stateless: the job id encodes its own start time — `j_<epoch-ms>`
// (or `jf_<epoch-ms>` for the flavour that fails at 60%) — so
// progress is a pure function of the wall clock. A demo job
// "completes" in ~8 s; ids older than 10 minutes render the expired
// tombstone. Cancelled state can't be stored, but the cancelled card
// carries no trigger, so nothing ever re-polls a cancelled job — the
// statelessness is invisible in practice.

import { DOCS_BASE, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/async-job`;

const DURATION_MS = 8000;
const FAIL_AT = 0.6;
const EXPIRE_MS = 10 * 60 * 1000;
const TOTAL_ROWS = 30000;

/** id → { start, failing } | null */
function parseId(id) {
  const m = /^(jf?)_(\d+)$/.exec(id ?? '');
  if (!m) return null;
  return { start: Number.parseInt(m[2], 10), failing: m[1] === 'jf' };
}

function runningCard(id, fraction) {
  const pct = Math.floor(fraction * 100);
  const rows = Math.floor(fraction * TOTAL_ROWS);
  return `<div class="hc-card" data-hc-job
     data-hx-get="${API}/exports/${id}" data-hx-trigger="every 1s"
     data-hx-target="this" data-hx-swap="outerHTML">
  <progress class="hc-progress" value="${pct}" max="100" aria-label="Export progress"></progress>
  <p aria-live="polite">Exporting — ${rows.toLocaleString('en-US')} / ${TOTAL_ROWS.toLocaleString('en-US')} rows (${pct}%)</p>
  <button class="hc-button" type="button"
          data-hx-post="${API}/exports/${id}/cancel"
          data-hx-target="closest [data-hc-job]"
          data-hx-swap="outerHTML">Cancel</button>
</div>`;
}

function doneCard(id) {
  return `<div class="hc-card" data-hc-job data-state="done">
  <p aria-live="polite">Export ready — ${TOTAL_ROWS.toLocaleString('en-US')} rows.</p>
  <a class="hc-button" data-variant="primary" href="${API}/exports/${id}/result" download>Download CSV</a>
</div>`;
}

function failedCard() {
  return `<div class="hc-card" data-hc-job data-state="failed">
  <div class="hc-alert" data-variant="error" role="status">
    <p class="hc-alert__title">Export failed.</p>
    <p class="hc-alert__body">Row 18,204: invalid date. Fix the data or
      retry — nothing was written.</p>
  </div>
  <button class="hc-button" type="submit"
          data-hx-post="${API}/exports"
          data-hx-target="closest [data-hc-job]"
          data-hx-swap="outerHTML">Retry</button>
</div>`;
}

function cancelledCard() {
  return `<div class="hc-card" data-hc-job data-state="cancelled">
  <p aria-live="polite">Export cancelled.</p>
</div>`;
}

function expiredCard() {
  return `<div class="hc-card" data-hc-job data-state="expired">
  <p aria-live="polite">This job has expired — start again.</p>
</div>`;
}

/** The current card for a job id, from the wall clock alone. */
function cardFor(id) {
  const parsed = parseId(id);
  if (!parsed) return expiredCard();
  const elapsed = Date.now() - parsed.start;
  if (elapsed < 0 || elapsed > EXPIRE_MS) return expiredCard();
  const fraction = Math.min(1, elapsed / DURATION_MS);
  if (parsed.failing && fraction >= FAIL_AT) return failedCard();
  if (fraction >= 1) return doneCard(id);
  return runningCard(id, fraction);
}

function csv() {
  const lines = ['id,name,amount'];
  for (let i = 1; i <= 20; i += 1) lines.push(`${i},Row ${i},${i * 100}`);
  lines.push(`… (demo file — a real export would carry all ${TOTAL_ROWS.toLocaleString('en-US')} rows)`);
  return lines.join('\n');
}

export async function handle({ method, path, url, request }) {
  if (method === 'POST' && path === '/exports') {
    let failing = url.searchParams.get('fail') === '1';
    if (!failing && request.headers.get('content-type')?.includes('form')) {
      const form = await request.formData().catch(() => null);
      failing = form?.get('fail') === '1';
    }
    const id = `${failing ? 'jf' : 'j'}_${Date.now()}`;
    const body = runningCard(id, 0);
    if (isHtmx(request)) return html(body, { status: 202 });
    return page('Async job demo', `${body}
<p><a href="${API}/exports/${id}">Check status</a> (no-JS: refresh this link)</p>`, { status: 202 });
  }

  const jobMatch = path.match(/^\/exports\/([a-z0-9_]+)$/);
  if (method === 'GET' && jobMatch) {
    const body = cardFor(jobMatch[1]);
    if (isHtmx(request)) return html(body);
    return page('Async job demo', `${body}
<p><a href="${API}/exports/${jobMatch[1]}">Refresh status</a></p>`);
  }

  const cancelMatch = path.match(/^\/exports\/([a-z0-9_]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    // Cancelling a job that is no longer running is a no-op 200 by
    // contract: answer with the job's actual terminal card.
    const card = cardFor(cancelMatch[1]);
    return html(card.includes('data-hx-trigger') ? cancelledCard() : card);
  }

  const resultMatch = path.match(/^\/exports\/([a-z0-9_]+)\/result$/);
  if (method === 'GET' && resultMatch) {
    const parsed = parseId(resultMatch[1]);
    if (!parsed || parsed.failing || Date.now() - parsed.start < DURATION_MS) {
      return html(expiredCard(), { status: 404 });
    }
    return new Response(csv(), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="export.csv"',
      },
    });
  }

  return null;
}
