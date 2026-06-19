# copy — server response contract

Purpose: copy a read-only value (share URL, token, generated snippet) to the clipboard.

## No server interaction

This recipe is **purely client-side** — there is no request and no
server response to contract. The `installCopy()` behavior reads a value
already on the page and writes it to the clipboard. It never touches the
network (htmx owns requests).

## Required client markup

- `data-hc-copy="<css-selector>"` — copy the referenced element's `value`
  (for `input` / `textarea` / `select`) or `textContent` (anything else); or
- `data-hc-copy-text="<literal>"` — copy a literal string instead.
- Optional `data-hc-copy-ok="Copied"` — the success label announced to
  assistive tech; defaults to the i18n catalog key `copy.ok`.

The trigger should be a real `<button type="button">` so it is
keyboard-activatable.

## Behavior flow

1. User activates the copy button.
2. `hc.behaviors.js` reads the source value and calls
   `navigator.clipboard.writeText(...)`.
3. On success the behavior sets `data-hc-copied` on the button for ~1.5 s
   (CSS can reflect it), announces the success label through a
   behavior-owned visually-hidden `role="status"` region, and dispatches a
   bubbling `hc:copied` event (`detail: { text }`).

## Chaining (optional)

`hc:copied` is a normal bubbling event. To raise a toast on copy with no
inline JS, point htmx at it (`data-hx-trigger="hc:copied"`) or add a
listener that dispatches `hc:toast`. Copy never opens a toast itself.

## Progressive enhancement

The Clipboard API needs a secure context (https / localhost). Where it is
unavailable the click is a graceful no-op; for a form-control target the
behavior best-effort selects its text so the user can copy manually. The
underlying value is always visible/selectable without the behavior.

## Accessibility

- A real `<button>` — keyboard-activatable, works on touch (click, not hover).
- Success is announced via `role="status"`; the button keeps its own
  accessible name throughout (it is never relabeled to "Copied").
