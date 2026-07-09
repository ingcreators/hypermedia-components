// field-errors — recipes/field-errors/contract.md
//
//   POST /members  (form fields: email, display_name)
//     → 422 + the canonical field-errors fragment when validation
//       fails (blank email → `required`; taken@example.com →
//       `duplicate` with an i18n message key), swapped into the
//       form's errors container
//     → 200 + empty body + `HX-Trigger: {"hc:toast": …}` on success
//       (the empty swap clears previous errors; the toast proves the
//       happy path)
//
// Non-htmx POSTs (no-JS fallback) get a full page reporting the
// result, with the same fragment rendered inline on failure.

import { escapeHtml, html, hxTrigger, isHtmx, page } from '../html.mjs';

/** Validate the submitted email; returns 0..1 field-error items. */
export function validateMember(email) {
  const value = String(email ?? '').trim();
  if (value === '') {
    return [{ field: 'email', code: 'required', message: 'Email is required.' }];
  }
  if (value.toLowerCase() === 'taken@example.com') {
    return [{
      field: 'email',
      code: 'duplicate',
      messageKey: 'members.email.duplicate',
      message: 'This email is already registered.',
    }];
  }
  return [];
}

/** The canonical field-errors fragment (contract.md, verbatim shape). */
export function errorsFragment(errors, title = 'Please fix the errors below.') {
  const items = errors
    .map((e) => {
      const key = e.messageKey ? `\n        data-message-key="${e.messageKey}"` : '';
      return `    <li class="hc-alert__error" data-field="${e.field}" data-code="${e.code}"${key}>${escapeHtml(e.message)}</li>`;
    })
    .join('\n');
  return `<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
  <p class="hc-alert__title">${escapeHtml(title)}</p>
  <ul class="hc-alert__errors">
${items}
  </ul>
</div>`;
}

export async function handle({ method, path, request }) {
  if (method === 'POST' && path === '/members') {
    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    const displayName = String(data.get('display_name') ?? '');
    const errors = validateMember(email);

    if (isHtmx(request)) {
      if (errors.length > 0) {
        return html(errorsFragment(errors), { status: 422 });
      }
      // Empty 200 body clears the errors container; the toast is the
      // success signal (installToast listens for hc:toast).
      return html('', {
        headers: {
          'HX-Trigger': hxTrigger({
            'hc:toast': { message: 'Member saved', variant: 'success' },
          }),
        },
      });
    }

    // No-JS fallback: report the validation result as a full page.
    if (errors.length > 0) {
      return page(
        'Member not saved',
        `<p>The submission failed validation. Without JavaScript the
canonical fragment renders as a plain error summary — nothing is lost:</p>
${errorsFragment(errors)}`,
        { status: 422 },
      );
    }
    return page(
      'Member saved',
      `<p>Saved ${escapeHtml(email)}${displayName ? ` (${escapeHtml(displayName)})` : ''}.</p>`,
    );
  }
  return null;
}
