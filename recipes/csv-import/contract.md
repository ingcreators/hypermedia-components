# csv-import — server response contract

Purpose: bulk CSV in, two phases with no surprises — upload parses and validates without importing, the response is a validation report (summary + real error table + tokened confirm form), and committing the token executes exactly what was validated.

## Required client markup

- The upload form is the [file-upload](../file-upload/) form shape
  (both its checks apply): `enctype="multipart/form-data"` **and**
  `data-hx-encoding="multipart/form-data"`, a labeled file input, a
  `[data-hc-upload-progress]` bar, and `data-hx-disabled-elt` as the
  double-submit guard. It targets the report slot
  (`data-hx-target="#import-report"`, `innerHTML` default).
- The report slot (`<div id="import-report" aria-live="polite">`) is
  where the validation report — and later the commit result — lands.
- The **confirm form is server-rendered** inside the report: it POSTs
  `/imports/<token>/commit` with the token both in the `action` path
  and as a hidden `token` input (the machine-checkable anchor; the
  server may read either — the pair must match). Keep `method="post"`
  + `action` for no-JS, and `data-hx-disabled-elt` — committing twice
  is exactly what tokens exist to prevent.

## Upload — `POST /imports` (multipart, file field `csv`)

| Case | Response |
| --- | --- |
| all rows valid | `200` + report: "N rows ready" + the confirm form (hidden `token`) |
| some rows invalid | `200` + report: summary with the skipped count, the error table (`Row` / `Field` / `Message` — a real `<table>` with `scope` on the header cells and the row number as a `scope="row"` header), and the "import the valid N" confirm form |
| nothing valid / unreadable file | `422` + the error report (or the file-level error line) — **no confirm form** |
| re-upload | a fresh report with a fresh token — replacing the batch is always allowed |

Uploading never imports. The report is the whole phase-1 answer: what
will happen, what will be skipped, and the single affordance to make
it so.

## Commit — `POST /imports/<token>/commit`

| Case | Response |
| --- | --- |
| live token | `200` + the result summary (replaces the report) + `HX-Trigger` with an `hc:toast` **and a domain event** (e.g. `items:changed`) so [data-region](../data-region/) listeners refresh the grid |
| expired / consumed token | `409` + the re-upload hint fragment — tokens are **single-shot**; the fix is always a fresh upload, never a retry |

The `409` swaps via the consolidated page-level allowance
(`[401, 409, 422]` — the same `htmx:beforeSwap` shape the
[edit-conflict](../edit-conflict/) and [session-expiry](../session-expiry/)
recipes use).

## Token rules

- The token references the **server-held parsed batch** — the commit
  executes exactly the rows that were validated, even if the file on
  the user's disk has changed since.
- Single-shot: committing consumes it; a second commit (double click,
  replayed request) answers `409`.
- Opaque to the client: never parse it, never build one client-side.

## Progressive enhancement (no JS)

The native multipart post works because `enctype` is on the form; the
server answers a full report page whose confirm form posts natively
too (classic post/redirect/get — real apps `303` to `/imports/<token>`
since they hold the batch server-side). Without JavaScript the flow is
identical, one page at a time.

## Accessibility

- The report slot is `aria-live="polite"` — the summary, the error
  report, and the commit result are announced without stealing focus.
- The error table is a real `<table>` with a `<caption>`,
  `scope="col"` column headers, and the row number as a `scope="row"`
  header — navigable cell by cell.
- The progress bar carries an `aria-label`; the upload button disables
  while the request runs.

## Notes

- CSV parsing belongs to the server. The demo implements a tiny strict
  parser (comma, `"quoted"` fields with `""` escapes, `\r\n?` rows)
  and real apps bring their own — the wire contract does not change.
- Merge/diff UIs for import conflicts are out of scope: the 409 answer
  is re-upload.
- Pair the commit's domain event with the [data-region](../data-region/)
  recipe so the grid the rows land in refreshes itself.
