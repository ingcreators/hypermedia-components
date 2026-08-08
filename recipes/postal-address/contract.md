# postal-address — server response contract

Purpose: postal-code → address autofill — a masked postal input triggers one lookup GET; the server fills the address inputs out of band and reports through a polite hint slot.

## Required client markup

- The postal input carries `data-hc-mask="postal-jp"` (installMask,
  auto-installed) so `change[target.value.length==8]` is a complete
  `123-4567` — the mask makes the trigger guard exact.
- `data-hx-include="this"` sends the input's own `postal=` parameter;
  `data-hx-target` points at the hint slot (`#postal-result`,
  `aria-live="polite"`).
- The address inputs (`#pref`, `#city`, `#addr1`) keep stable ids —
  they are the out-of-band swap anchors. Render them with
  `autocomplete` tokens (`address-level1/2`, `address-line1`) so
  browser autofill still works alongside the lookup.
- Forms that prefer an explicit affordance can put the same
  `data-hx-get` on a 「住所検索」 button with
  `data-hx-include="#postal"` instead of the change trigger — the
  responses are identical.

## Lookup — `GET /address-by-postal?postal=123-4567`

| Case | Response (200 unless noted) |
| --- | --- |
| single hit | a short status line for the hint slot, **plus OOB `outerHTML` re-renders** of the address inputs — same ids and classes, `value` filled, `data-hx-swap-oob="outerHTML"` |
| multiple hits | a compact candidate list into the hint slot: each candidate is a small `<button type="button">` re-calling the endpoint with `&choice=<n>`, whose response is the single-hit shape |
| not found | a hint line ("no match — enter the address manually"); **no** OOB swaps |
| malformed `postal` | `422` + a hint line (swaps via the standard 422 allowance) |

## Out-of-band rules

- OOB inputs must re-render **complete** elements (class, id, name,
  `autocomplete`, value) — `outerHTML` replaces the whole input, and a
  re-rendered input must remain the same control the label points at.
- Overwriting user-typed values is the point of autofill; a server that
  wants to be conservative may omit the OOB swap for inputs it detects
  as user-modified only if it tracks that itself — the contract does
  not require it.
- The `choice` responses fill exactly like single hits; the candidate
  list simply disappears when the hint slot is re-swapped.

## Progressive enhancement (no JS)

The address inputs are ordinary inputs — manual entry always works;
the lookup is pure enhancement. Keep `pattern="\d{3}-\d{4}"` +
`placeholder` on the postal input so native validation matches the
mask.

## Accessibility

- The hint slot is `aria-live="polite"`: fills, candidate lists, and
  no-match messages are announced without stealing focus.
- Candidate buttons are real `<button type="button">` elements inside
  the hint slot — reachable by keyboard in DOM order right after the
  postal input.
- The OOB swap keeps ids stable, so `<label for>` associations survive
  the replacement.

## Notes

- The server owns the postal database; the client never parses
  addresses. Response values are plain input re-renders — no JSON.
- `data-hc-mask-submit="raw"` on the postal input changes only the
  *form submit* wire value (7-digit style); the lookup parameter is the
  displayed `123-4567` either way because `data-hx-include="this"`
  reads the live value.
