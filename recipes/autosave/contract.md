# autosave — server response contract

Purpose: debounced draft autosave for long forms — a request-owning div posts the whole form as a draft while the user types, and a restore banner offers the draft back after a crash or navigation; zero new JavaScript.

## Required client markup

- A `<div>` **inside the form** owns the draft request:
  `data-hx-post="…/draft"`, `data-hx-include="closest form"`,
  `data-hx-trigger="input from:closest form changed delay:2s"`,
  targeting a polite status slot (`#draft-status`,
  `aria-live="polite"`). The div is non-interactive and empty —
  request wiring only.
- The form itself keeps its record contract
  ([mutating-form](../mutating-form/)) and, recommended, the
  [unsaved-changes](../unsaved-changes/) guard: the draft div's
  request has a different `elt`, so **a draft save does not clean the
  guard** — a draft is not the record.

## Endpoints

| Case | Response |
| --- | --- |
| `POST …/draft` (each debounced burst) | `200` + a status line for `#draft-status` ("Draft saved at 14:03:12" — server-timestamped). Drafts are **stored raw and never validated**; validation belongs to the record save. |
| `POST …` (the record save) | the mutating-form contract; on success the server deletes the draft and the returned status says so |
| page render while a draft is newer than the record | the server renders the form **from the record** plus a restore banner (`hc-alert`): Restore (`data-hx-get="…/draft"` targeting the form, `outerHTML`) / Discard (`data-hx-delete="…/draft"` targeting the banner, `outerHTML`) |
| `GET …/draft` (restore) | `200` + the whole form re-rendered from draft values, **with `data-dirty` preset** — draft content is unsaved by definition, and the guard warns from the attribute alone |
| `DELETE …/draft` | `200` + empty fragment (the banner disappears) |
| no-JS | the form posts natively (PRG); drafts simply never happen — pure enhancement |

## Draft hygiene (server-side, normative)

- **Drop sensitive fields**: never store `type="password"` values (or
  any field the domain marks secret) in drafts.
- Drafts are per-user, per-record, last-write-wins; a background purge
  (age or record-save) keeps the table bounded.
- The debounce (`delay:2s`) is the client's floor; servers may also
  rate-limit the endpoint.

## Accessibility

- `#draft-status` is `aria-live="polite"` — save confirmations are
  announced without stealing focus; keep them short and stable
  ("Draft saved at …"), not chatty.
- The restore banner is an `hc-alert` with real buttons, before the
  form in DOM order.

## Notes

- The trigger uses `from:closest form` so bubbling `input` events from
  every field arm the same debounced timer; `changed` keeps no-op
  keystrokes (arrow keys) from posting.
- With [installFormat](../../packages/core/src/js/format.js) fields,
  the draft body carries canonical raw values — the same `formdata`
  rewrite applies to every `new FormData(form)`.
