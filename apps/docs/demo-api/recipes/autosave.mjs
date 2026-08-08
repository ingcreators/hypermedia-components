// autosave — recipes/autosave/contract.md
//
//   POST /reports/42/draft → 200, status line for #autosave-demo-draft-status
//   POST /reports/42       → 200, record-save status (draft "cleared")
//   GET  /reports/42/draft → 200, the whole demo form re-rendered from
//                            the posted-back title, data-dirty preset
//   DELETE /reports/42/draft → 200, empty fragment (banner removal)
//
// Stateless per the live-demos doctrine: the "draft" is whatever the
// client just posted — the restore fragment threads the title through
// the query string instead of server state.

import { DOCS_BASE, escapeHtml, html } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/autosave`;

function stamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export function handle({ url, method, path }) {
  if (path === '/reports/42/draft' && method === 'POST') {
    return html(`<span>Draft saved at ${stamp()}.</span>`);
  }

  if (path === '/reports/42' && method === 'POST') {
    return html(`<span>Saved at ${stamp()} — draft cleared.</span>`);
  }

  if (path === '/reports/42/draft' && method === 'GET') {
    const title = url.searchParams.get('title') ?? 'Quarterly report (draft)';
    return html(`<form id="autosave-demo-report" class="hc-stack" data-hc-dirty-guard data-dirty
      data-hx-post="${API}/reports/42"
      data-hx-target="#autosave-demo-status" data-hx-swap="innerHTML">
  <div class="hc-field">
    <label class="hc-field__label" for="autosave-demo-title">Title</label>
    <input class="hc-input" id="autosave-demo-title" name="title" value="${escapeHtml(title)}">
  </div>
  <div data-hx-post="${API}/reports/42/draft"
       data-hx-include="closest form"
       data-hx-trigger="input from:closest form changed delay:2s"
       data-hx-target="#autosave-demo-draft-status" data-hx-swap="innerHTML"></div>
  <p class="hc-field__hint" id="autosave-demo-draft-status" aria-live="polite">Restored from draft — unsaved.</p>
  <p class="hc-field__hint" id="autosave-demo-status" aria-live="polite"></p>
  <button class="hc-button" data-variant="primary" type="submit">Save</button>
</form>`);
  }

  if (path === '/reports/42/draft' && method === 'DELETE') {
    return html('');
  }

  return null;
}
