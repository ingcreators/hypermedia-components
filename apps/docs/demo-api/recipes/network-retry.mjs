// network-retry — recipes/network-retry/contract.md
//
//   POST /save           → 200, a receipt card
//   POST /save (down=1)  → sleeps past the demo form's declared 1.5s
//                          timeout, so the CLIENT gives up first and
//                          htmx fires htmx:timeout — the one failure
//                          a server-side demo can reproduce honestly.
//                          (?fast=1 skips the sleep for tests.)
//
// There is deliberately no error branch here: this recipe's failure
// mode is the absence of a response, not a response. The late body
// below arrives after the client aborted and is discarded.

import { escapeHtml, html, isHtmx, page } from '../html.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function handle({ method, path, url, request }) {
  if (method === 'POST' && path === '/save') {
    const form = await request.formData();
    const amount = escapeHtml(String(form.get('amount') ?? '').trim());
    const down = String(form.get('down') ?? '') === '1';

    if (down) {
      if (url.searchParams.get('fast') !== '1') await sleep(4000);
      // The client's declared timeout (1.5s) has long fired; htmx
      // aborted the request and this body is discarded.
      return html('<p data-late-response>Too late — the client already gave up.</p>');
    }

    const body = `<div class="hc-card">
  <p>Saved — ¥${amount || '0'}. The network answered, so any
    retry banner just cleared itself.</p>
</div>`;
    return isHtmx(request) ? html(body) : page('Network retry demo', body);
  }

  return null;
}
