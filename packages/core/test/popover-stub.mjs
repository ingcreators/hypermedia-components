// Rendering half of the popover stub every behavior test installs.
//
// jsdom implements no popover algorithm: there is no showPopover(), and its UA
// stylesheet carries `[popover]:not(:popover-open) { display: none }`, a rule
// whose :popover-open half can never match. Since jsdom 30.1 an element under a
// `display: none` ancestor is no longer a focusable area, so a stub that only
// records the open state (an attribute each test file picks to match what its
// subject reads) leaves the popover's items unreachable by focus() — roving
// focus, type-ahead and submenu tests then see document.body as activeElement.
//
// Each stub's show / hide calls these to supply what the real algorithm would:
// an open popover is rendered, a closed one is not. Inline styles are used
// because jsdom resolves the UA sheet ahead of author sheets for `display`.

export function renderPopover(el) {
  el.style.display = 'block';
}

export function unrenderPopover(el) {
  el.style.removeProperty('display');
}
