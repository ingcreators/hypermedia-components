// datagrid-bulk-errors — recipes/datagrid-bulk-errors/contract.md
//
//   POST /bulk        (ids, action=archive)  — BEST-EFFORT
//     → 200: rows reflecting what happened (failures marked, reason
//       via aria-describedby) + the OOB report grouped by reason +
//       a warning toast that does not auto-dismiss
//   GET  /preflight   (ids, action=post)     — ATOMIC, phase 1
//     → 200: the executability report; when some rows are blocked it
//       offers "exclude the blockers and run the rest" carrying only
//       the executable ids; when none are, no submit at all
//   POST /bulk        (ids, action=post)     — ATOMIC, phase 2
//     → 200 when every id is executable; otherwise 409 with the rows
//       UNCHANGED, the checkboxes KEPT, and refusal copy
//
// Stateless: eligibility is derived from the row id alone (see
// SHIPPED / NOT_YOURS), so the same selection always yields the same
// answer.

import { DOCS_BASE, escapeHtml, html, hxTrigger } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/datagrid-bulk-errors`;

/** 8 deterministic products; the reason (if any) is a pure function. */
const ITEMS = [101, 102, 103, 104, 105, 106, 107, 108].map((id) => ({
  id,
  name: `Product ${id}`,
}));

/**
 * Why this row cannot be acted on — null means it can. Explicit sets
 * rather than a formula, so the demo's outcome is readable from here:
 * 102 / 105 / 108 are shipped, 107 is not yours.
 */
const SHIPPED = new Set([102, 105, 108]);
const NOT_YOURS = new Set([107]);

function blockedReason(id) {
  if (SHIPPED.has(id)) return '出荷済みのため変更できません';
  if (NOT_YOURS.has(id)) return '権限がありません';
  return null;
}

function tooltipId(id) {
  return `bulk-errors-demo-why-${id}`;
}

function rowHtml(item, { failed = false, status = 'Active' } = {}) {
  const reason = failed ? blockedReason(item.id) : null;
  const cellAttrs = reason ? ` aria-describedby="${tooltipId(item.id)}"` : '';
  const tip = reason
    ? `<span class="hc-tooltip" id="${tooltipId(item.id)}">${escapeHtml(reason)}</span> <a href="#bulk-errors-demo-report">詳細</a>`
    : '';
  return `<tr class="hc-datagrid__row" id="bulk-errors-demo-row-${item.id}"${failed ? ' data-tone="error"' : ''}>
  <td class="hc-datagrid__cell"><input type="checkbox" class="hc-checkbox" name="ids" value="${item.id}" aria-label="Select ${escapeHtml(item.name)}"></td>
  <td class="hc-datagrid__cell">${escapeHtml(item.name)}</td>
  <td class="hc-datagrid__cell"${cellAttrs}>${escapeHtml(status)} ${tip}</td>
</tr>`;
}

/** ids → { ok: number[], blocked: Map<reason, number[]> } */
function split(ids) {
  const ok = [];
  const blocked = new Map();
  for (const id of ids) {
    const reason = blockedReason(id);
    if (!reason) {
      ok.push(id);
      continue;
    }
    if (!blocked.has(reason)) blocked.set(reason, []);
    blocked.get(reason).push(id);
  }
  return { ok, blocked };
}

const CAP = 3; // the demo's inline cap (10 in real apps — see contract)

function reasonTableHtml(blocked) {
  const rows = [...blocked.entries()]
    .map(([reason, ids]) => {
      const named = ids
        .slice(0, CAP)
        .map(
          (id) =>
            `<a href="#bulk-errors-demo-row-${id}">${id} Product ${id}</a>`,
        )
        .join(', ');
      const rest = ids.length > CAP ? ` … <span>他 ${ids.length - CAP} 件</span>` : '';
      return `<tr><th scope="row">${escapeHtml(reason)}</th><td data-numeric>${ids.length}</td><td>${named}${rest}</td></tr>`;
    })
    .join('\n');
  return `<table class="hc-table" data-density="compact">
  <thead><tr><th scope="col">理由</th><th scope="col" data-numeric>件数</th><th scope="col">対象</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

// Header values are latin-1 — the blessed \uXXXX transform (toast
// contract) keeps Japanese messages legal on the wire.
function toastHeader(message, variant) {
  return { 'HX-Trigger': hxTrigger({ 'hc:toast': { message, variant } }) };
}

// The main swap target is a <tbody>, so htmx parses the response in a
// table context: a bare <div> OOB fragment gets foster-parented and its
// nested <table> mangled. <template> is htmx's blessed escape for
// exactly this (contract.md, "Riding along with a tbody swap").
function bulkReport(inner, { oob = false } = {}) {
  const oobAttr = oob ? ' data-hx-swap-oob="innerHTML"' : '';
  const div = `<div id="bulk-errors-demo-report" aria-live="polite"${oobAttr}>${inner}</div>`;
  return oob ? `<template>${div}</template>` : div;
}

export async function handle({ method, path, url, request }) {
  // ---- Atomic phase 1: pre-flight -------------------------------
  if (method === 'GET' && path === '/preflight') {
    const ids = url.searchParams.getAll('ids').map(Number).filter(Boolean);
    const { ok, blocked } = split(ids);
    if (ids.length === 0) {
      return html(
        bulkReport('<p role="status">行を選択してください。</p>'),
      );
    }
    if (blocked.size === 0) {
      return html(
        bulkReport(`<div class="hc-alert" data-variant="info" role="status">
  <p><strong>${ok.length} 件を実行します。</strong></p>
  <form data-hx-post="${API}/bulk" data-hx-target="#bulk-errors-demo-rows" data-hx-swap="innerHTML">
    <input type="hidden" name="action" value="post">
    ${ok.map((id) => `<input type="hidden" name="ids" value="${id}">`).join('')}
    <button class="hc-button" data-variant="primary" type="submit">実行</button>
  </form>
</div>`),
      );
    }
    const blockedCount = ids.length - ok.length;
    const excludeForm = ok.length
      ? `<form data-hx-post="${API}/bulk" data-hx-target="#bulk-errors-demo-rows" data-hx-swap="innerHTML">
    <input type="hidden" name="action" value="post">
    ${ok.map((id) => `<input type="hidden" name="ids" value="${id}">`).join('')}
    <button class="hc-button" data-variant="primary" type="submit">${blockedCount} 件を除いて ${ok.length} 件を実行</button>
  </form>`
      : '<p>実行できる行がありません。</p>';
    return html(
      bulkReport(`<div class="hc-alert" data-variant="warning" role="status">
  <p><strong>${ids.length} 件のうち ${ok.length} 件が実行可能</strong>、${blockedCount} 件は不可です。</p>
  ${reasonTableHtml(blocked)}
  ${excludeForm}
</div>`),
    );
  }

  if (method !== 'POST' || path !== '/bulk') return null;

  const form = await request.formData();
  const ids = form.getAll('ids').map(Number).filter(Boolean);
  const action = String(form.get('action') ?? 'archive');
  const { ok, blocked } = split(ids);

  // ---- Atomic phase 2 -------------------------------------------
  if (action === 'post') {
    if (blocked.size > 0) {
      // Refusal: rows UNCHANGED, checkboxes KEPT, refusal copy.
      const rows = ITEMS.map(
        (item) =>
          rowHtml(item).replace(
            `value="${item.id}"`,
            `value="${item.id}"${ids.includes(item.id) ? ' checked' : ''}`,
          ),
      ).join('\n');
      const blockedCount = ids.length - ok.length;
      return html(
        `${rows}
${bulkReport(`<div class="hc-alert" data-variant="error" role="alert">
  <p><strong>実行しませんでした。</strong>${blockedCount} 件が条件を満たさないため、${ids.length} 件すべてを取り消しました。</p>
  ${reasonTableHtml(blocked)}
</div>`, { oob: true })}`,
        {
          status: 409,
          headers: toastHeader(
            `実行しませんでした（${blockedCount} 件が条件を満たしません）`,
            'error',
          ),
        },
      );
    }
    const rows = ITEMS.map((item) =>
      rowHtml(item, { status: ids.includes(item.id) ? 'Posted' : 'Active' }),
    ).join('\n');
    return html(
      `${rows}
${bulkReport(`<p role="status">${ok.length} 件を計上しました。</p>`, { oob: true })}`,
      { headers: toastHeader(`${ok.length} 件を計上しました`, 'success') },
    );
  }

  // ---- Best-effort ----------------------------------------------
  const rows = ITEMS.map((item) => {
    if (!ids.includes(item.id)) return rowHtml(item);
    const failed = blockedReason(item.id) != null;
    return rowHtml(item, { failed, status: failed ? 'Active' : 'Archived' });
  }).join('\n');

  if (blocked.size === 0) {
    return html(
      `${rows}
${bulkReport(`<p role="status">${ok.length} 件をアーカイブしました。</p>`, { oob: true })}`,
      { headers: toastHeader(`${ok.length} 件をアーカイブしました`, 'success') },
    );
  }
  const failedCount = ids.length - ok.length;
  return html(
    `${rows}
${bulkReport(`<div class="hc-alert" data-variant="warning" role="status">
  <p><strong>${ok.length} 件成功 / ${failedCount} 件失敗</strong>（対象 ${ids.length} 件）</p>
  ${reasonTableHtml(blocked)}
  <p><a href="${API}/items?f-last-result=failed">失敗した行だけに絞り込む</a></p>
</div>`, { oob: true })}`,
    {
      headers: toastHeader(
        `${ok.length} 件成功 / ${failedCount} 件失敗`,
        'warning',
      ),
    },
  );
}
