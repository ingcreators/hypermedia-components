// multi-step-form — recipes/multi-step-form/contract.md
//
//   GET  /signup/1|2|3  → 200, the whole wizard fragment for that step
//                         (full page when no HX-Request — deep links)
//   POST /signup/1|2|3  → nav=back: 200 + previous step (never validates)
//                         nav=next valid: 200 + next step
//                         nav=next invalid: 422 + HX-Retarget/HX-Reswap,
//                           body = the field-errors fragment only
//                         step 3 nav=next: 204 + HX-Redirect (htmx) /
//                           303 + Location (no JS) to /welcome
//   GET  /welcome       → 200, plain confirmation page echoing the draft
//
// Stateless (contract-blessed trick): the draft rides as hidden inputs
// inside every rendered step — each POST receives the accumulated
// fields, each response re-emits them. Back merges without validating;
// only "next" validates. GET deep links accept the draft as query
// params, which is also how the completion redirect carries it.

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/multi-step-form`;
const WIZARD_ID = 'multi-step-form-demo-wizard';

const STEPS = [
  { title: 'Account', field: 'email', label: 'Email', error: 'Enter your email address.' },
  { title: 'Profile', field: 'display_name', label: 'Display name', error: 'Enter a display name.' },
  { title: 'Review', field: null },
];

const FIELDS = STEPS.map((s) => s.field).filter(Boolean);

function readDraft(get) {
  const draft = {};
  for (const field of FIELDS) draft[field] = get(field) ?? '';
  return draft;
}

function stepperHtml(current) {
  const items = STEPS.map((step, i) => {
    const n = i + 1;
    if (n < current) {
      return `    <li class="hc-stepper__step" data-state="complete">
      <span class="hc-stepper__marker" aria-hidden="true">✓</span>
      <span class="hc-stepper__label">${step.title}
        <span class="hc-sr-only">(completed)</span></span>
    </li>`;
    }
    const cur = n === current ? ' aria-current="step"' : '';
    return `    <li class="hc-stepper__step"${cur}>
      <span class="hc-stepper__marker" aria-hidden="true">${n}</span>
      <span class="hc-stepper__label">${step.title}</span>
    </li>`;
  });
  return `  <ol class="hc-stepper">\n${items.join('\n')}\n  </ol>`;
}

function fieldsHtml(current, draft) {
  const step = STEPS[current - 1];

  // The draft travels as hidden inputs — except this step's own field,
  // which renders as a real, pre-filled control.
  const hidden = FIELDS.filter((f) => f !== step.field)
    .map((f) => `    <input type="hidden" name="${f}" value="${escapeHtml(draft[f])}">`)
    .join('\n');

  let body = '';
  if (step.field) {
    const inputId = `${WIZARD_ID}-${step.field.replaceAll('_', '-')}`;
    const type = step.field === 'email' ? 'email' : 'text';
    body = `    <div class="hc-field">
      <label class="hc-field__label" for="${inputId}">${step.label}</label>
      <input class="hc-input" id="${inputId}" type="${type}"
             name="${step.field}" value="${escapeHtml(draft[step.field])}" required>
    </div>`;
  } else {
    body = `    <dl>
${STEPS.filter((s) => s.field)
  .map(
    (s) => `      <dt>${s.label}</dt>
      <dd>${escapeHtml(draft[s.field]) || '<em>(blank)</em>'}</dd>`,
  )
  .join('\n')}
    </dl>`;
  }
  return `${hidden}\n\n${body}`;
}

/** The complete wizard fragment for a step — every response's body. */
function wizardFragment(current, draft, errorsHtml = '') {
  const step = STEPS[current - 1];
  const back =
    current > 1
      ? `    <button class="hc-button" type="submit" name="nav" value="back"
            formnovalidate>Back</button>\n`
      : '';
  const nextLabel = current === STEPS.length ? 'Create account' : 'Next';
  return `<section id="${WIZARD_ID}">
${stepperHtml(current)}

  <form method="post" action="${API}/signup/${current}"
        data-hx-post="${API}/signup/${current}"
        data-hx-target="#${WIZARD_ID}" data-hx-swap="outerHTML"
        data-hx-disabled-elt="find button[type=submit]">
    <div id="${WIZARD_ID}-errors">${errorsHtml}</div>

    <h2>${step.title}</h2>

${fieldsHtml(current, draft)}

${back}    <button class="hc-button" data-variant="primary" type="submit"
            name="nav" value="next">${nextLabel}</button>
  </form>
</section>`;
}

/** Canonical field-errors fragment (recipes/field-errors/contract.md). */
function fieldErrorsFragment(step) {
  return `<div class="hc-alert" data-variant="error" role="alert" data-hc-field-errors>
  <p class="hc-alert__title">Please fix the field below.</p>
  <ul class="hc-alert__errors">
    <li class="hc-alert__error" data-field="${step.field}" data-code="required">${step.error}</li>
  </ul>
</div>`;
}

function stepResponse(request, current, draft, { status = 200, errorsHtml = '' } = {}) {
  const fragment = wizardFragment(current, draft, errorsHtml);
  if (isHtmx(request)) return html(fragment, { status });
  // No-JS / deep-link branch: the same fragment as a full page.
  return page('Sign up — multi-step form demo', fragment, { status });
}

export async function handle({ request, url, method, path }) {
  const stepMatch = path.match(/^\/signup\/([123])$/);

  if (method === 'GET' && stepMatch) {
    const current = Number(stepMatch[1]);
    const draft = readDraft((f) => url.searchParams.get(f));
    return stepResponse(request, current, draft);
  }

  if (method === 'POST' && stepMatch) {
    const current = Number(stepMatch[1]);
    const form = await request.formData();
    const draft = readDraft((f) => form.get(f));

    // Back never validates — merge whatever arrived into the draft and
    // render the previous step (drafts are never validated).
    if (form.get('nav') === 'back') {
      return stepResponse(request, Math.max(1, current - 1), draft);
    }

    // Next validates this step's field.
    const step = STEPS[current - 1];
    if (step.field && draft[step.field].trim() === '') {
      if (isHtmx(request)) {
        // Steer the fragment into the error container — the step
        // itself is NOT re-rendered (in-progress DOM values stay).
        return html(fieldErrorsFragment(step), {
          status: 422,
          headers: {
            'HX-Retarget': `#${WIZARD_ID}-errors`,
            'HX-Reswap': 'innerHTML',
          },
        });
      }
      // No-JS: full page at the same step with the errors rendered.
      return stepResponse(request, current, draft, {
        status: 422,
        errorsHtml: fieldErrorsFragment(step),
      });
    }

    if (current < STEPS.length) {
      return stepResponse(request, current + 1, draft);
    }

    // Final step: the mutating-form completion branching.
    const params = new URLSearchParams();
    for (const field of FIELDS) params.set(field, draft[field]);
    const location = `${API}/welcome?${params}`;
    if (isHtmx(request)) {
      return new Response(null, { status: 204, headers: { 'HX-Redirect': location } });
    }
    return new Response(null, { status: 303, headers: { Location: location } });
  }

  if (method === 'GET' && path === '/welcome') {
    const draft = readDraft((f) => url.searchParams.get(f));
    return page(
      'Account created',
      `<p>The wizard finished — this plain page is the redirect target.</p>
<dl>
  <dt>Email</dt><dd>${escapeHtml(draft.email)}</dd>
  <dt>Display name</dt><dd>${escapeHtml(draft.display_name)}</dd>
</dl>
<p><a href="${DOCS_BASE}/recipes/multi-step-form/">Back to the multi-step-form recipe</a></p>`,
    );
  }

  return null;
}
