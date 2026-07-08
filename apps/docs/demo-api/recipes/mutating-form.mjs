// mutating-form — recipes/mutating-form/contract.md
//
//   POST /members     (form fields: email, display_name)
//     → 422 + field-errors fragment (blank email → `required`;
//       taken@example.com → `duplicate`) into #…-errors
//     → 204 + `HX-Redirect: …/members/42` (htmx success — htmx
//       performs a full window.location navigation)
//     → 303 + `Location: …/members/42` (no-JS success — classic
//       post/redirect/get)
//   GET  /members/42  → "Member created" landing page (the
//       post/redirect/get destination; echoes `?email=` back)
//
// The confirmed delete variant is not demoed here — the
// confirm-action demo covers confirm-gated requests. Redirect URLs
// carry DOCS_BASE because the browser resolves them against the
// origin, where the docs Worker is mounted under the base.

import { DOCS_BASE, escapeHtml, isHtmx, page } from '../html.mjs';
import { errorsFragment, validateMember } from './field-errors.mjs';

const MEMBER_URL = `${DOCS_BASE}/api/recipes/mutating-form/members/42`;

export async function handle({ method, path, url, request }) {
  if (method === 'POST' && path === '/members') {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim();
    const errors = validateMember(email);

    if (errors.length > 0) {
      const fragment = errorsFragment(errors, 'Please fix the errors below.');
      if (isHtmx(request)) {
        return new Response(fragment, {
          status: 422,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      // No-JS: full page with the fragment inline (the summary alert
      // renders every error as a plain list — nothing is lost).
      return page(
        'Member not created',
        `<p>The submission failed validation:</p>\n${fragment}`,
        { status: 422 },
      );
    }

    const location = `${MEMBER_URL}?email=${encodeURIComponent(email)}`;
    if (isHtmx(request)) {
      // Empty body + HX-Redirect: htmx navigates the whole window.
      return new Response(null, {
        status: 204,
        headers: { 'HX-Redirect': location },
      });
    }
    // No-JS: plain post/redirect/get.
    return new Response(null, {
      status: 303,
      headers: { Location: location },
    });
  }

  if (method === 'GET' && path === '/members/42') {
    const email = url.searchParams.get('email') ?? '';
    return page(
      'Member created',
      `<p>This is the demo's post/redirect/get landing page — the URL the
success branch redirects to (<code>HX-Redirect</code> over htmx, a plain
<code>303 Location</code> without JavaScript).</p>
<p>Member <strong>#42</strong>${email ? ` — ${escapeHtml(email)}` : ''} was created.</p>
<p><a href="${DOCS_BASE}/recipes/mutating-form/">Back to the mutating-form recipe</a></p>`,
    );
  }

  return null;
}
