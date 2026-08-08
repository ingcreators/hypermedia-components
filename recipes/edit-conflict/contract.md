# edit-conflict — server response contract

Purpose: optimistic locking for edit forms — a hidden version rides every save, a stale save answers 409 with a conflict dialog offering overwrite / reload, and no custom JavaScript is involved.

## Required client markup

- The edit form carries the version it was rendered from:
  `<input type="hidden" name="version" value="12">`, and a stable id
  (the conflict dialog's buttons anchor their `data-hx-include` on it).
- The shared error host from the
  [session-expiry](../session-expiry/) recipe:
  `<div id="error-dialog" data-hc-remote-dialog-root></div>`
  (`data-hc-session-expiry` optional — the two recipes share the slot).
- The page-level allowance must include `409`
  (`[401, 409, 422]` consolidated — same `htmx:beforeSwap` shape).

## Endpoints

| Case | Response |
| --- | --- |
| `PUT` with the current `version` | the [mutating-form](../mutating-form/) success contract; the fragment (or an OOB input) carries the **new** version so the next save is armed |
| `PUT` with a stale `version` | `409` + `HX-Retarget: #error-dialog` + `HX-Reswap: innerHTML` + a conflict `<dialog>`: a compact theirs/yours table, **Overwrite** (`data-hx-put="…?force=1"` + `data-hx-include` of the user's fields **plus a fresh hidden `version` from the dialog itself**), **Reload** (`data-hx-get="…/edit"` swapping the form `outerHTML` — discards local edits), and a `<form method="dialog">` "keep editing" escape. Both action buttons carry `data-hc-close-dialog-on-success` |
| `PUT` with `force=1` and the fresh version | overwrite wins → success contract (audit-logging the override is the server's business); still `409` if the record moved *again* |
| `GET …/edit` | `200` + the whole edit form re-rendered from the current record (fresh version) |
| no-JS | the native POST answers a full `409` page offering the same two choices as links/forms (PRG) |

## Conflict-dialog rules

- The dialog's version field is the **current** one from the moment of
  conflict — forcing with it means "I saw v13 and chose to overwrite";
  a second racer bumps to v14 and the force 409s again. The version
  never comes from the losing form.
- The theirs/yours table shows the fields that differ (server-diffed);
  it is presentation, not a merge tool — merge UIs are out of scope.
- Closing the dialog ("keep editing") leaves the user's form untouched
  and armed with the old version — saving again re-conflicts, by
  design.

## Accessibility

- A real `<dialog>` via `showModal()` (native focus trap + `Escape`),
  named by `aria-labelledby`.
- The theirs/yours table is a real table with row/column headers.
- Outcomes land in the form's `aria-live` status slot.

## Notes

- Version can be an integer, a ULID, or an ETag — the contract only
  requires equality-comparable and monotonic-per-save.
- Pair with [unsaved-changes](../unsaved-changes/): the reload button
  discards local edits, and the guard's confirm has already been
  answered by clicking it (the swap replaces the form wholesale).
