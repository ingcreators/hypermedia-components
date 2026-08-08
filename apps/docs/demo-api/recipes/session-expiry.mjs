// session-expiry — recipes/session-expiry/contract.md
//
//   POST /tickets/7/approve → 200 status line (session cookie present)
//                           → 401 + HX-Retarget + login dialog (absent)
//   POST /session/login     → 200 + Set-Cookie + HX-Trigger
//                             hc:sessionrenewed (password "wrong" → 422
//                             re-rendered dialog with the inline error)
//   POST /session/expire    → 200 + cookie cleared (demo reset button)
//
// "State" is a client-held cookie scoped to this namespace — the server
// stays stateless per the live-demos doctrine. The cookie is the demo's
// session; expiring it re-arms the 401 branch.

import { DOCS_BASE, escapeHtml, html, hxTrigger } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/session-expiry`;
const COOKIE = 'hc_demo_session';
const COOKIE_PATH = `${DOCS_BASE}/api/recipes/session-expiry`;

function hasSession(request) {
  const cookies = request.headers.get('cookie') ?? '';
  return cookies.split(';').some((c) => c.trim().startsWith(`${COOKIE}=1`));
}

function stamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function loginDialog({ error = '' } = {}) {
  return `<dialog class="hc-dialog" aria-labelledby="session-expiry-demo-title">
  <form class="hc-stack" data-hx-post="${API}/session/login"
        data-hx-target="this" data-hx-swap="none">
    <h2 class="hc-dialog__title" id="session-expiry-demo-title">Session expired</h2>
    <p>Sign in again to continue — your action will complete automatically.
       (Any password works; "wrong" fails.)</p>
    <div class="hc-field"${error ? ' data-invalid="true"' : ''}>
      <label class="hc-field__label" for="session-expiry-demo-password">Password</label>
      <input class="hc-input" id="session-expiry-demo-password" name="password"
             type="password" autocomplete="current-password" required${
               error ? ' aria-invalid="true" aria-describedby="session-expiry-demo-error"' : ''
             }>
      ${error ? `<p class="hc-field__error" id="session-expiry-demo-error">${escapeHtml(error)}</p>` : ''}
    </div>
    <button class="hc-button" data-variant="primary" type="submit">Sign in</button>
  </form>
  <form method="dialog">
    <button class="hc-button" data-variant="ghost">Cancel</button>
  </form>
</dialog>`;
}

export async function handle({ request, method, path }) {
  if (method !== 'POST') return null;

  if (path === '/tickets/7/approve') {
    if (hasSession(request)) {
      return html(`<span>Approved at ${stamp()}.</span>`);
    }
    return html(loginDialog(), {
      status: 401,
      headers: {
        'HX-Retarget': '#session-expiry-demo-dialog',
        'HX-Reswap': 'innerHTML',
      },
    });
  }

  if (path === '/session/login') {
    const body = await request.formData();
    const password = body.get('password') ?? '';
    if (password === 'wrong') {
      return html(loginDialog({ error: 'That password is not right — try any other.' }), {
        status: 422,
        headers: {
          'HX-Retarget': '#session-expiry-demo-dialog',
          'HX-Reswap': 'innerHTML',
        },
      });
    }
    return html('', {
      headers: {
        'Set-Cookie': `${COOKIE}=1; Path=${COOKIE_PATH}; Max-Age=300; SameSite=Lax`,
        'HX-Trigger': hxTrigger({ 'hc:sessionrenewed': {} }),
      },
    });
  }

  if (path === '/session/expire') {
    return html(`<span>Session expired — click Approve to see the 401 flow.</span>`, {
      headers: {
        'Set-Cookie': `${COOKIE}=; Path=${COOKIE_PATH}; Max-Age=0; SameSite=Lax`,
      },
    });
  }

  return null;
}
