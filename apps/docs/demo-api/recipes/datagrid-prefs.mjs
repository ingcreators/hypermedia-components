// datagrid-prefs — recipes/datagrid-prefs/contract.md
//
//   POST /prefs/columns  (w-<col> pairs)
//     → 200 htmx: the status fragment ("Saved — Name 220px …")
//     → no-JS: 303 PRG (the docs demo only exercises the htmx path)
//     invalid values are clamped/ignored — a width is a preference,
//     never an error
//
// Stateless like every docs demo: the answer echoes what a real server
// would persist per user and render back as inline widths on later
// loads (contract.md, "Rendering back").

import { escapeHtml, html } from '../html.mjs';

const LABELS = { name: 'Name', status: 'Status', owner: 'Owner' };

export async function handle({ method, path, request }) {
  if (method !== 'POST' || path !== '/prefs/columns') return null;

  const form = await request.formData();
  const saved = [];
  for (const [key, value] of form.entries()) {
    const col = key.startsWith('w-') ? key.slice(2) : null;
    if (!col || !(col in LABELS)) continue;
    const w = Number.parseInt(String(value), 10);
    if (!Number.isFinite(w) || w <= 0) continue; // ignore, never an error
    saved.push(`${LABELS[col]} ${Math.min(Math.max(w, 40), 800)}px`);
  }
  const text = saved.length > 0 ? `Saved — ${saved.join(', ')}` : 'Nothing to save yet';
  return html(`<span>${escapeHtml(text)}</span>`);
}
