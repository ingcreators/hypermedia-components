// workflow-actions — recipes/workflow-actions/contract.md
//
//   GET  /region?state=…&version=…  → 200, the actions region
//   POST /transition                → 200 applied / 422 comment
//                                     required / 409 stale or illegal
//                                     — always the re-rendered region
//
// Stateless: the document's state and version thread through hidden
// inputs (a real server reads its database; the demo reads the
// form — the same trick as the datagrid-bulk-actions demo's `state`
// input). The demo lifecycle: submitted → approved (approve) or
// returned-with-comment (return); returned → submitted (resubmit).
// A `race=1` flag simulates another user having approved first:
// version mismatch → 409 with the region re-rendered from "their"
// truth.

import { DOCS_BASE, html, hxTrigger, isHtmx, page } from '../html.mjs';

const API = `${DOCS_BASE}/api/recipes/workflow-actions`;
const REGION_ID = 'workflow-actions-demo-region';

const STATES = new Set(['submitted', 'returned', 'approved']);

function stepHtml(label, n, { complete = false, current = false } = {}) {
  const state = complete ? ' data-state="complete"' : '';
  const cur = current ? ' aria-current="step"' : '';
  const marker = complete ? '✓' : String(n);
  const done = complete ? '<span class="hc-sr-only">(completed)</span>' : '';
  return `<li class="hc-stepper__step"${state}${cur}>
    <span class="hc-stepper__marker" aria-hidden="true">${marker}</span>
    <span class="hc-stepper__label">${label}${done}</span>
  </li>`;
}

function stepperHtml(state) {
  return `<ol class="hc-stepper">
  ${stepHtml('Draft', 1, { complete: state !== 'returned', current: state === 'returned' })}
  ${stepHtml('Review', 2, { complete: state === 'approved', current: state === 'submitted' })}
  ${stepHtml('Done', 3, { complete: state === 'approved', current: state === 'approved' })}
</ol>`;
}

function button(transition, label, { primary = false } = {}) {
  const variant = primary ? ' data-variant="primary"' : '';
  return `<button class="hc-button"${variant} type="submit" name="transition" value="${transition}"
      data-hx-post="${API}/transition"
      data-hx-target="#${REGION_ID}" data-hx-swap="outerHTML"
      data-hx-disabled-elt="this">${label}</button>`;
}

/**
 * The whole actions region. `notice` renders an alert at the top;
 * `commentField` renders the required-comment 422 shape.
 */
function regionHtml(state, version, { notice = null, commentField = false } = {}) {
  const alert = notice
    ? `<div class="hc-alert" data-variant="warning" role="status">
  <p class="hc-alert__title">${notice.title}</p>
  <p class="hc-alert__body">${notice.body}</p>
</div>\n`
    : '';
  const comment = commentField
    ? `<div class="hc-field">
  <label class="hc-field__label" for="${REGION_ID}-comment">Reason for returning</label>
  <textarea class="hc-input" id="${REGION_ID}-comment" name="comment" required aria-invalid="true"></textarea>
  <p class="hc-field__message" data-variant="error">A returned document needs a reason the author can act on.</p>
</div>\n`
    : '';
  let toolbar = '';
  if (state === 'submitted') {
    toolbar = `<div class="hc-toolbar" role="toolbar" aria-label="Document actions">
  ${commentField ? '' : button('approve', 'Approve', { primary: true })}
  ${button('return', 'Return for revision')}
  ${commentField ? '' : `<button class="hc-button" data-variant="ghost" type="submit" name="transition" value="approve"
      data-hx-post="${API}/transition" data-hx-vals='{"race":"1"}'
      data-hx-target="#${REGION_ID}" data-hx-swap="outerHTML"
      data-hx-disabled-elt="this">Approve (lose the race)</button>`}
</div>`;
  } else if (state === 'returned') {
    toolbar = `<div class="hc-toolbar" role="toolbar" aria-label="Document actions">
  ${button('resubmit', 'Resubmit', { primary: true })}
</div>`;
  } else {
    toolbar = `<p class="hc-field__hint">Approved — nothing left to do.
  <a href="${API}/region?state=submitted&amp;version=7"
     data-hx-get="${API}/region?state=submitted&amp;version=7"
     data-hx-target="#${REGION_ID}" data-hx-swap="outerHTML">Reset the demo</a></p>`;
  }
  return `<form method="post" action="${API}/transition" id="${REGION_ID}" data-hc-workflow>
<input type="hidden" name="state" value="${state}">
<input type="hidden" name="version" value="${version}">
${alert}${stepperHtml(state)}
${comment}${toolbar}
</form>`;
}

export async function handle({ method, path, url, request }) {
  if (method === 'GET' && path === '/region') {
    const state = STATES.has(url.searchParams.get('state')) ? url.searchParams.get('state') : 'submitted';
    const version = Number.parseInt(url.searchParams.get('version') ?? '7', 10) || 7;
    const body = regionHtml(state, version);
    return isHtmx(request) ? html(body) : page('Workflow actions demo', body);
  }

  if (method === 'POST' && path === '/transition') {
    const form = await request.formData();
    const state = STATES.has(String(form.get('state'))) ? String(form.get('state')) : 'submitted';
    const version = Number.parseInt(String(form.get('version') ?? ''), 10) || 7;
    const transition = String(form.get('transition') ?? '');
    const race = form.get('race') === '1';

    // Simulated lost race: "someone else" already approved and bumped
    // the version, so this submission's version is stale.
    if (race) {
      return html(
        regionHtml('approved', version + 2, {
          notice: {
            title: 'Already approved.',
            body: 'Suzuki approved this document while you were reviewing it. Your action was not applied.',
          },
        }),
        {
          status: 409,
          headers: {
            'HX-Trigger': hxTrigger({
              'hc:toast': { message: 'Suzuki approved this document first', variant: 'warning' },
            }),
          },
        },
      );
    }

    const legal = {
      submitted: ['approve', 'return'],
      returned: ['resubmit'],
      approved: [],
    }[state];
    if (!legal.includes(transition)) {
      // Illegal from the current state (e.g. a double-click racing
      // itself): 409, region from current truth.
      return html(
        regionHtml(state, version, {
          notice: {
            title: 'Nothing to apply.',
            body: `“${transition || '?'}” is not available in the current state.`,
          },
        }),
        { status: 409 },
      );
    }

    if (transition === 'return' && !String(form.get('comment') ?? '').trim()) {
      return html(regionHtml(state, version, { commentField: true }), { status: 422 });
    }

    const next = { approve: 'approved', return: 'returned', resubmit: 'submitted' }[transition];
    return html(regionHtml(next, version + 1), {
      headers: {
        'HX-Trigger': hxTrigger({
          'hc:toast': {
            message: { approved: 'Approved', returned: 'Returned for revision', submitted: 'Resubmitted' }[next],
            variant: 'success',
          },
        }),
      },
    });
  }

  return null;
}
