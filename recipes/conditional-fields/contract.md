# conditional-fields — server response contract

Purpose: hide the fields the chosen mode does not read, declaratively —
no round-trip, no focus loss, no inline JS.

## No server interaction

This recipe is **purely client-side** — there is no request and no
server response to contract. The `installShowWhen()` behavior toggles
the `hidden` attribute from values already on the page. It never touches
the network (htmx owns requests).

## Required client markup

- `data-hc-show-switch` — on the controlling form control (select, radio
  group, checkbox, or text input). The behavior resolves the closest
  form's switch for each conditional element.
- `data-hc-show-when="<value> [<value> …]"` — on any element; visible
  while the switch value is in the whitespace-separated list.
- Optional `data-hc-show-src="<css-selector>"` — overrides the switch
  per element (resolved against the document) for cross-form cases.

## Behavior flow

1. `hc.behaviors.js` evaluates every `[data-hc-show-when]` at install,
   so server-rendered state is honored before any interaction.
2. On every `change`, visibility is re-evaluated — no request, focus
   stays where it is.
3. Elements swapped in by htmx are evaluated when they arrive
   (MutationObserver + `htmx:afterSwap` / `htmx:oobAfterSwap`).

## Semantics

- Visibility is the `hidden` attribute — never inline `display` styles.
  Kit containers re-assert `[hidden]` where their own `display` would
  outweigh the UA rule (`.hc-field` does); a custom container that sets
  `display` needs the same one-liner
  (`.my-container[hidden] { display: none; }`).
- **Hidden controls keep submitting.** Filtering the values it does not
  read is the server's job; visibility is presentation.
- An element whose switch cannot be resolved is left untouched
  (server-rendered `hidden` state stays).

## Progressive enhancement

Without the behavior every field is simply visible — the form reads as
busier but stays fully usable, and the server contract is unchanged.
Render the initial `hidden` attributes server-side to match the default
switch value so the no-flash path also holds before the bundle loads.

## Accessibility

- `hidden` removes the fields from the accessibility tree and the tab
  order while hidden — screen-reader and keyboard users see exactly what
  sighted users see.
- Keep each conditional block a complete labeled field (`.hc-field` with
  its label inside), so showing it never reveals an unlabeled control.
- If revealing a field is essential context for the change the user just
  made, it appears in DOM order right after the switch — do not move
  focus; users continue tabbing naturally.
