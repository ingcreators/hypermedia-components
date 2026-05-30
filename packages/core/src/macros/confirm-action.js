// <hc-confirm-action> — optional Light DOM macro for the
// confirm-action recipe.
//
// Attributes (all optional unless noted):
//   action          (required) URL for the htmx request
//   method          get | post | put | patch | delete (default "post")
//   target          data-hx-target selector
//   swap            data-hx-swap mode (default "outerHTML")
//   variant         button variant (default omitted -> "default")
//   message         dialog body text (default "Continue?")
//   title           dialog title (default "Confirm")
//   confirm-label   confirm-button label (default "Confirm")
//   cancel-label    cancel-button label (default "Cancel")
//   disabled-elt    data-hx-disabled-elt (default "this")
//   indicator       data-hx-indicator (default "closest .hc-action")
//   no-spinner      boolean — omit the spinner
//
// The element's text content is used as the visible button label.

const VALID_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

function setIfPresent(el, attr, value) {
  if (value !== null && value !== undefined && value !== '') {
    el.setAttribute(attr, value);
  }
}

class HcConfirmAction extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hcUpgraded === 'true') return;
    this.dataset.hcUpgraded = 'true';
    this.style.display = this.style.display || 'inline-block';

    const ownerDocument = this.ownerDocument;

    const rawMethod = (this.getAttribute('method') || 'post').toLowerCase();
    const method = VALID_METHODS.has(rawMethod) ? rawMethod : 'post';

    const action = this.getAttribute('action');
    const target = this.getAttribute('target');
    const swap = this.getAttribute('swap') || 'outerHTML';
    const variant = this.getAttribute('variant');
    const message = this.getAttribute('message') || 'Continue?';
    const title = this.getAttribute('title');
    const confirmLabel = this.getAttribute('confirm-label');
    const cancelLabel = this.getAttribute('cancel-label');
    const disabledElt = this.getAttribute('disabled-elt') || 'this';
    const indicator = this.getAttribute('indicator') || 'closest .hc-action';
    const noSpinner = this.hasAttribute('no-spinner');

    const label = (this.textContent || 'Continue').trim();

    // Build the expanded DOM programmatically so attribute values are
    // never interpolated into strings.
    const wrapper = ownerDocument.createElement('span');
    wrapper.className = 'hc-action';

    const button = ownerDocument.createElement('button');
    button.className = 'hc-button';
    button.type = 'button';
    button.textContent = label;

    setIfPresent(button, 'data-variant', variant);
    if (action) button.setAttribute(`data-hx-${method}`, action);
    button.setAttribute('data-hx-trigger', 'hc:confirmed');
    setIfPresent(button, 'data-hx-target', target);
    button.setAttribute('data-hx-swap', swap);
    button.setAttribute('data-hx-disabled-elt', disabledElt);
    button.setAttribute('data-hx-indicator', indicator);
    button.setAttribute('data-hc-confirm', message);
    setIfPresent(button, 'data-hc-confirm-title', title);
    setIfPresent(button, 'data-hc-confirm-label', confirmLabel);
    setIfPresent(button, 'data-hc-cancel-label', cancelLabel);

    wrapper.appendChild(button);

    if (!noSpinner) {
      const spinner = ownerDocument.createElement('span');
      spinner.className = 'hc-spinner htmx-indicator';
      spinner.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(spinner);
    }

    this.replaceChildren(wrapper);

    // Let htmx pick up the newly-inserted attributes.
    if (globalThis.htmx && typeof globalThis.htmx.process === 'function') {
      globalThis.htmx.process(this);
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('hc-confirm-action')) {
  customElements.define('hc-confirm-action', HcConfirmAction);
}

export { HcConfirmAction };
