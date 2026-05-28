// <hc-live-search> — optional Light DOM macro for the live-search
// recipe (plan §15.4).
//
// Attributes:
//   action          (required) search endpoint URL
//   target          (required) selector for the results container
//   name            query parameter name (default "q")
//   placeholder     input placeholder (default "Search")
//   label           visible label text; if absent the input gets only
//                   an aria-label
//   aria-label      aria-label when no visible label is provided
//                   (default "Search")
//   delay           htmx debounce delay (default "300ms")
//   submit-label    submit-button label (default "Search")
//   swap            data-hx-swap (default "innerHTML")
//   no-submit       boolean — omit the submit button

let idCounter = 0;
function nextId() {
  return `hc-live-search-${++idCounter}`;
}

class HcLiveSearch extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hcUpgraded === 'true') return;
    this.dataset.hcUpgraded = 'true';
    this.style.display = this.style.display || 'block';

    const ownerDocument = this.ownerDocument;

    const action = this.getAttribute('action');
    const target = this.getAttribute('target');
    const name = this.getAttribute('name') || 'q';
    const placeholder = this.getAttribute('placeholder') || 'Search';
    const labelText = this.getAttribute('label');
    const ariaLabel = this.getAttribute('aria-label') || 'Search';
    const delay = this.getAttribute('delay') || '300ms';
    const submitLabel = this.getAttribute('submit-label') || 'Search';
    const swap = this.getAttribute('swap') || 'innerHTML';
    const noSubmit = this.hasAttribute('no-submit');

    const inputId = this.getAttribute('input-id') || nextId();

    const form = ownerDocument.createElement('form');
    form.className = 'hc-search';
    if (action) form.setAttribute('action', action);
    form.setAttribute('method', 'get');
    form.setAttribute('role', 'search');
    form.style.display = 'flex';
    form.style.gap = '0.5rem';

    if (labelText) {
      const label = ownerDocument.createElement('label');
      label.className = 'hc-field__label';
      label.setAttribute('for', inputId);
      label.textContent = labelText;
      form.appendChild(label);
    }

    const input = ownerDocument.createElement('input');
    input.className = 'hc-input';
    input.id = inputId;
    input.type = 'search';
    input.name = name;
    input.setAttribute('placeholder', placeholder);
    if (!labelText) input.setAttribute('aria-label', ariaLabel);

    if (action) input.setAttribute('data-hx-get', action);
    input.setAttribute(
      'data-hx-trigger',
      `input changed delay:${delay}, search`,
    );
    if (target) input.setAttribute('data-hx-target', target);
    input.setAttribute('data-hx-swap', swap);
    input.setAttribute('data-hx-sync', 'closest form:replace');

    form.appendChild(input);

    if (!noSubmit) {
      const button = ownerDocument.createElement('button');
      button.className = 'hc-button';
      button.type = 'submit';
      button.textContent = submitLabel;
      form.appendChild(button);
    }

    this.replaceChildren(form);

    if (globalThis.htmx && typeof globalThis.htmx.process === 'function') {
      globalThis.htmx.process(this);
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('hc-live-search')) {
  customElements.define('hc-live-search', HcLiveSearch);
}

export { HcLiveSearch };
