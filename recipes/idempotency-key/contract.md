# idempotency-key — server response contract

Purpose: server-side duplicate-submit defence — every rendered form carries a one-time key, and the server answers a replayed key with the original response, never with an error.

## Why the client guard is not enough

[mutating-form](../mutating-form/)'s `data-hx-disabled-elt` disables
the button *after the click leaves*: it cannot help against a timeout
retry, a flaky network resending the request, a
[session-expiry](../session-expiry/) replay, or a user pressing Enter
twice faster than the disable lands. Only the server can make a
submission single-shot, and the mechanism is a token.

## The contract

- **One key per rendered form.** The server mints a fresh, opaque,
  unguessable `idempotency_key` every time it renders the form (not
  per submit — every submit of this form instance claims the same
  intent). The client echoes it; it is never composed client-side.
- **First commit**: process, store `key → (request-hash, response)`,
  answer normally.
- **Replayed key, same payload**: **replay the stored response** —
  status, headers that matter (`HX-Trigger`, `Location`), body. A
  duplicate is indistinguishable from the first success, which is
  exactly what the double-clicking user needs to see. Replay ≠ error:
  answering 409 punishes the user for the network.
- **Replayed key, different payload** (request-hash mismatch): a real
  conflict — **422** with a message naming what already exists. Same
  intent token + different content is a bug or a stale tab, not a
  retry.
- **422 validation failures are stored and replayed too** — the key
  is spent by the *attempt*, not the success? No: spend the key only
  on **commit** (2xx/redirect). A validation failure leaves the key
  live, so the corrected resubmit (same form instance, same key)
  can commit. This is the one subtlety; get it backwards and users
  can never fix a validation error.
- **Scope + TTL are declared policy**: per user × per form, hours not
  forever. The storage row: `key, user, request_hash, response,
  created_at`; expire by TTL. A replay after expiry is a fresh
  commit — pair the form with [edit-conflict](../edit-conflict/) /
  unique business constraints for the truly paranoid paths.

## Endpoints

| Request | Response |
| --- | --- |
| `POST /orders` (fresh key) | the normal outcome — 200 fragment, 303 redirect, or 422 validation |
| `POST /orders` (seen key, same payload) | **the stored response, replayed** |
| `POST /orders` (seen key, different payload) | **422** — "already submitted with different values", naming the existing record |

## Composition

- **PRG**: the stored response for a redirect flow is the `303` +
  `Location` — a replay lands on the same receipt page, which is the
  right answer to "did my order go through?".
- **[async-job](../async-job/contract.md)**: the stored response for
  a job kick-off is the `202` + the job card — both clicks end up
  watching the same job.
- **[workflow-actions](../workflow-actions/contract.md)**: the 409
  covers *losing to someone else*; this key covers *racing yourself*.
- **[session-expiry](../session-expiry/)**'s replayed request carries
  the same key — that's the point.

## Progressive enhancement

Nothing here is JavaScript at all: the key is a hidden field and the
guarantees are server-side. The no-JS full-page POST follows the same
three branches (the replay of a full page is a full page).

## Accessibility

The result region is `aria-live="polite"`; the replayed response
should read the same as the original (the demo adds a hint line so
the mechanism is visible — a real app may replay byte-identically).
The 422 conflict is an `hc-alert` with `role="status"`.

## Notes

- Mint keys with a CSPRNG (UUID v4 is fine); the key authorizes
  nothing by itself — authz is the request's own business.
- Replaying **headers that matter** is part of the contract:
  a stored `HX-Trigger` toast replays too (the user who double-clicked
  still sees "Order placed").
- Cleaning the storage is a TTL sweep, not a correctness concern —
  after expiry the business-level uniqueness rules are the backstop.
