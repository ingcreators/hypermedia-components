// submit-on.js — a control that IS the action posts its form itself.
//
//   installSubmitOnChange   [data-hc-submit-on-change]
//   installSubmitOnEnter    [data-hc-submit-on-enter]
//
//   <form method="post" action="/flags" data-hx-post="/flags"
//         data-hx-target="closest .hc-card" data-hx-swap="outerHTML">
//     <label class="hc-field">
//       <input class="hc-switch" type="checkbox" role="switch" name="beta"
//              data-hc-submit-on-change>
//       Beta features
//     </label>
//     <noscript><button class="hc-button">Save</button></noscript>
//   </form>
//
//   <div class="hc-inputotp" data-length="6"
//        data-hc-submit-on-change="hc:otpcomplete">…</div>
//
//   <textarea class="hc-input" name="prompt" data-hc-submit-on-enter></textarea>
//
// submit-on-change:
//   - On `change` — or on the event the attribute VALUE names, e.g.
//     `hc:otpcomplete` for a code that should post the moment it fills —
//     the element's form is submitted with `form.requestSubmit()`.
//     Constraint validation runs, the form's `submit` event fires, and
//     htmx (when the form carries an hx verb) takes the request from
//     there, so every hook that rides the form's submit path applies:
//     `hx-sync`, the dirty guard, the CSRF header, close-on-success.
//     A plain form submits natively.
//   - The attribute may sit on the control, or on a container whose
//     descendants' `change` events bubble to it (a fieldset of switches).
//   - EXEMPT: a control that carries its own htmx verb, or a form whose
//     `hx-trigger` includes `change` — htmx already drives those on
//     change, and a second submit would double-fire. Same shape as
//     installConfirm's verb exemption, decided once here instead of in
//     every consumer's listener.
//   - Without JavaScript the control simply does not auto-submit; a Save
//     button (in <noscript>, or always visible) keeps the no-JS path.
//
// submit-on-enter:
//   - Enter in the field submits its form; Shift+Enter and Alt+Enter
//     insert the newline as usual, Ctrl/Cmd+Enter submits too (the other
//     convention chat users carry).
//   - An Enter that ends an IME composition (`isComposing`, or the legacy
//     keyCode 229) is ignored — it confirmed the candidate, not the
//     message. Disabled and readonly fields are left alone.
//   - Meant for a <textarea> (an <input> submits on Enter natively).
//
// Neither behavior touches the network; both are idempotent per root and
// return an uninstaller.

import { hasRemovals, pruneDetachers } from './lifecycle.js';

const HX_VERBS = ['get', 'post', 'put', 'patch', 'delete'];

function hasHxVerb(el) {
  return HX_VERBS.some(
    (verb) => el.hasAttribute(`hx-${verb}`) || el.hasAttribute(`data-hx-${verb}`),
  );
}

// `hx-trigger="change"`, `"change delay:300ms"`, `"keyup, change"` — the
// word `change` anywhere in the trigger spec, on the form itself.
function hxTriggersOnChange(form) {
  const spec = form.getAttribute('hx-trigger') || form.getAttribute('data-hx-trigger') || '';
  return /(^|[\s,])change\b/.test(spec);
}

function formFor(el) {
  // Form-associated controls know their owner (`form=` attribute
  // included); anything else — a container, the OTP root — uses the
  // nearest ancestor form.
  const own = /** @type {any} */ (el).form;
  if (own && own.tagName === 'FORM') return own;
  return el.closest('form');
}

function submit(form) {
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
  else form.submit();
}

function isComposingEnter(event) {
  return event.isComposing === true || event.keyCode === 229;
}

/* ------------------------------------------------------------------ */
/* Shared install scaffolding                                          */
/* ------------------------------------------------------------------ */

function install(root, key, selector, attach) {
  if (!root) return () => {};
  if (root[key]) return root[key];

  const detachers = new Map();
  for (const el of root.querySelectorAll(selector)) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      if (hasRemovals(records)) pruneDetachers(detachers);
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.(selector)) attach(node, detachers);
          node.querySelectorAll?.(selector).forEach((el) => attach(el, detachers));
        }
      }
    });
    observer.observe(root.body ?? root, { childList: true, subtree: true });
  }

  const uninstall = () => {
    if (root[key] !== uninstall) return;
    if (observer) observer.disconnect();
    for (const detach of detachers.values()) detach();
    detachers.clear();
    delete root[key];
  };
  root[key] = uninstall;
  return uninstall;
}

/* ------------------------------------------------------------------ */
/* submit-on-change                                                    */
/* ------------------------------------------------------------------ */

const CHANGE_KEY = '__hcSubmitOnChangeUninstall';
const CHANGE_SELECTOR = '[data-hc-submit-on-change]';

function attachChange(el, detachers) {
  if (detachers.has(el)) return;
  const eventName = el.getAttribute('data-hc-submit-on-change') || 'change';

  const onEvent = () => {
    const form = formFor(el);
    if (!form) return;
    // htmx-driven on change already — never double-submit.
    if (hasHxVerb(el) || hxTriggersOnChange(form)) return;
    submit(form);
  };
  el.addEventListener(eventName, onEvent);
  detachers.set(el, () => el.removeEventListener(eventName, onEvent));
}

/**
 * Install the submit-on-change behavior: every `[data-hc-submit-on-change]`
 * element submits its form (`form.requestSubmit()`) on `change`, or on the
 * event the attribute value names (e.g. `hc:otpcomplete`). A control that
 * carries its own htmx verb, or a form whose `hx-trigger` includes
 * `change`, is exempt — htmx already drives it.
 *
 * @param {Document|Element} [root]
 * @returns {() => void} Uninstaller. Idempotent per root.
 */
export function installSubmitOnChange(
  root = typeof document !== 'undefined' ? document : null,
) {
  return install(root, CHANGE_KEY, CHANGE_SELECTOR, attachChange);
}

/* ------------------------------------------------------------------ */
/* submit-on-enter                                                     */
/* ------------------------------------------------------------------ */

const ENTER_KEY = '__hcSubmitOnEnterUninstall';
const ENTER_SELECTOR = '[data-hc-submit-on-enter]';

function attachEnter(el, detachers) {
  if (detachers.has(el)) return;

  const onKeydown = (event) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey || event.altKey) return; // newline
    if (isComposingEnter(event)) return; // IME: confirmed a candidate
    if (el.disabled || el.readOnly) return;
    const form = formFor(el);
    if (!form) return;
    event.preventDefault();
    submit(form);
  };
  el.addEventListener('keydown', onKeydown);
  detachers.set(el, () => el.removeEventListener('keydown', onKeydown));
}

/**
 * Install the submit-on-enter behavior: Enter in a
 * `[data-hc-submit-on-enter]` field submits its form; Shift+Enter /
 * Alt+Enter insert the newline; an Enter that ends an IME composition is
 * ignored.
 *
 * @param {Document|Element} [root]
 * @returns {() => void} Uninstaller. Idempotent per root.
 */
export function installSubmitOnEnter(
  root = typeof document !== 'undefined' ? document : null,
) {
  return install(root, ENTER_KEY, ENTER_SELECTOR, attachEnter);
}
