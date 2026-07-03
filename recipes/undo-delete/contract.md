# undo-delete — server response contract

Purpose: undo instead of confirm — delete executes immediately, the
server soft-deletes with a grace period, and the result toast's Undo
button restores the item at its original position. Zero new JavaScript:
a pure composition of the [toast](../toast/) action button, htmx event
triggers, and the 200-with-truth doctrine. The counterpart to
[confirm-action](../confirm-action/) — pick one, don't stack both
(§Choosing undo vs confirm). Stable under the
[markup versioning policy](../../VERSIONING.md).

## Required client markup

One button per item, in the [request-action](../request-action/) shape
— **no `data-hc-confirm`**:

```html
<tr id="item-42">
  <td>Anvil</td>
  <td>
    <button class="hc-button" data-size="sm"
            data-hx-delete="/items/42"
            data-hx-target="closest tr"
            data-hx-swap="outerHTML"
            data-hx-disabled-elt="this">Delete</button>
  </td>
</tr>
```

`installToast()` must be installed (auto-init
`@hypermedia-components/core/behaviors`).

## Delete — `200` + a tombstone + the undo toast

The response replaces the row with a **tombstone**: a hidden element
that preserves the DOM slot and carries the restore wiring.

```text
DELETE /items/42
HTTP/1.1 200 OK
HX-Trigger: {"hc:toast":{"id":"undo-item-42","message":"\"Anvil\" deleted","variant":"info","duration":10000,"action":{"label":"Undo","event":"item-42:restore"}}}
```

```html
<tr id="item-42" hidden
    data-hx-post="/items/42/restore"
    data-hx-trigger="item-42:restore from:body"
    data-hx-swap="outerHTML"></tr>
```

- The **pairing key** (`item-42:restore`) is one server-generated
  string in exactly two places: the toast's `action.event` and the
  tombstone's `data-hx-trigger`. Clicking Undo dispatches that event
  (bubbling to `body` — the shipped toast behavior); the tombstone
  hears it via `from:body` and POSTs the restore. Keys are per-item,
  so several pending undos never cross.
- Use the element that matches the list: `<tr hidden>` in tables
  (valid table semantics), `<li hidden>` in lists, `<div hidden>` in
  card grids.

## Restore — `200` + the original row

```text
POST /items/42/restore
HTTP/1.1 200 OK
HX-Trigger: {"hc:toast":{"id":"undo-item-42","message":"\"Anvil\" restored","variant":"success","duration":3000}}
```

Body = the item's normal row markup (the same fragment any re-render
produces). It replaces the tombstone via `outerHTML` — the item
reappears **at its original position**. Reusing the toast `id` updates
the undo toast in place when still visible; if it already expired, a
fresh toast appears — both correct.

Restore is **idempotent**: restoring an already-restored item returns
the row again (a no-op re-render).

## Grace period — server truth, the toast is only a hint

The server hard-deletes after its own grace window (recommended: at
least the toast duration; e.g. 10 s toast, 30–60 s grace). The toast
expiring, being dismissed, or being evicted by the region's
`data-limit` finalizes **nothing** — the affordance disappears, the
state does not.

Restore after expiry follows the 200-with-truth doctrine (no
status-code choreography, same as
[datagrid-bulk-actions](../datagrid-bulk-actions/contract.md)):

```text
POST /items/42/restore        (grace expired)
HTTP/1.1 200 OK
HX-Trigger: {"hc:toast":{"id":"undo-item-42","message":"Too late — \"Anvil\" was permanently deleted","variant":"error"}}
```

Body = the tombstone again (the slot stays empty). A non-2xx would not
swap and header handling on errors is htmx-version-dependent — `200`
with the truth avoids the question entirely.

## Choosing undo vs confirm

| | [confirm-action](../confirm-action/) | undo-delete |
| --- | --- | --- |
| Fits | rare, catastrophic, hard-to-reverse | frequent, recoverable |
| Cost | a dialog on every action | a grace window on the server |
| Failure mode | confirm fatigue (users stop reading) | expired grace (communicated by the error toast) |

Do **not** stack both on one action — a confirmed-then-undoable delete
buys nothing and pays both costs. (Whether a delete is undoable lives
server-side, so this is a design rule, not something `hc validate` can
see in the markup — a `data-hc-confirm` delete button is simply
validated as confirm-action instead.)

## Encoding the `HX-Trigger` header

HTTP header values are latin-1 — a toast message containing an em dash
or any localized text (Japanese, emoji, …) makes header serialization
throw in most server stacks. JSON's `\uXXXX` escapes keep the header
pure ASCII and htmx parses them natively; escape every non-ASCII
character when serializing `HX-Trigger` payloads:

```js
JSON.stringify(payload).replace(/[\u007f-\uffff]/g,
  (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
```

(This applies to every recipe that sends `HX-Trigger`, and it is easy
to miss until the first non-ASCII item name crashes a delete.)

## Composition notes

- **Datagrid**: the same pattern inside `.hc-datagrid__body` — the
  tombstone swaps in as a row, and the grid's tbody observer re-derives
  roles, offsets and selection on both delete and restore (a selection
  actions bar stays truthful).
- **Tombstones are inert leftovers**, bounded by page lifetime; any
  full re-render (a [data-region](../data-region/) refresh, pagination)
  prunes them naturally.

## Progressive enhancement (no JS)

Keep a form fallback if the delete must work without JavaScript
(`method="post"` route + `303` back, the
[mutating-form](../mutating-form/) branching). Undo itself is then
unavailable — the honest degradation for an enhancement whose entire
value lives in the toast; pair no-JS deletes with a confirm page
server-side if they need protection.

## Accessibility

- The undo toast is `variant: "info"` → `role="status"` (polite); the
  expiry failure is `variant: "error"` → `role="alert"`. Unchanged
  toast semantics.
- The Undo button is a real `<button>` inside the toast, reachable by
  keyboard while the toast is visible; the grace period being longer
  than the toast means keyboard users who miss it lose nothing they
  could not also lose by being slow — size the grace window
  accordingly.
- The tombstone is `hidden` and never focusable; restoring returns the
  row without stealing focus.
