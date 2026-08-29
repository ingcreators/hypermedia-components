# Recipes

Each subdirectory is one recipe and follows this contract:

```text
recipe.html     Short recommended usage (with hc-* classes and data-hx-*).
expanded.html   Fully expanded HTML — the copy-pasteable, framework-free form.
contract.md     Server response contract: what HTML / HX-Trigger to return.
checks.json     The contract's machine-readable rules — `npx
                @hypermedia-components/cli validate` checks your HTML
                against them.
```

Recipes are the source of truth for the `apps/docs/src/content/docs/recipes/*`
documentation pages.

## Index

| Recipe                                    | Purpose                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| [`request-action/`](request-action/)      | Button that sends an htmx request with a spinner.                       |
| [`mutating-form/`](mutating-form/)        | Post a form: inline 4xx field errors, success redirect, double-submit guard. |
| [`idempotency-key/`](idempotency-key/)    | Server-side duplicate-submit defence — one key per rendered form; replays get the original response. |
| [`confirm-action/`](confirm-action/)      | Confirm with the user before sending an htmx request.                   |
| [`copy/`](copy/)                          | Copy a read-only value (URL, token, snippet) to the clipboard.          |
| [`live-search/`](live-search/)            | Input that streams results as the user types.                           |
| [`result-cap/`](result-cap/)              | Bound what one search may return — cap+1 detection, "cap+" counts, truncation banner or hard reject. |
| [`toast/`](toast/)                        | Transient notification region driven by `hc:toast` events / HX-Trigger. |
| [`remote-dialog/`](remote-dialog/)        | Server-rendered `<dialog>` shown via htmx swap.                         |
| [`filter-popover/`](filter-popover/)      | Native `popover` element used as a filter sheet.                        |
| [`data-region/`](data-region/)            | Container that re-fetches itself in response to application events.     |
| [`async-job/`](async-job/)                | Work that outlives a request — 202 + a job card that polls itself to a terminal state. |
| [`network-retry/`](network-retry/)        | The request that got no answer — offline / timeout surfaced with a working Retry. |
| [`field-errors/`](field-errors/)          | Render server-side validation errors next to the fields they belong to. |
| [`reference-lookup/`](reference-lookup/)  | Master-reference field — code entry + search dialog; hidden id, unresolved code clears it. |
| [`inline-edit/`](inline-edit/)            | Display ↔ edit toggle that swaps the same DOM node each way.            |
| [`line-items/`](line-items/)              | Order/quote detail rows — add/remove/recalc as whole-form round trips; the server owns arithmetic. |
| [`lazy-panel/`](lazy-panel/)              | Panel whose content loads on first reveal (intersect / details / tab).  |
| [`lazy-tree/`](lazy-tree/)                | Tree branches that load their children on first expand (`hc:treeexpand once`). |
| [`datagrid-pager/`](datagrid-pager/)      | Paginate an `hc-datagrid` from the server with htmx.                    |
| [`datagrid-snapshot-pager/`](datagrid-snapshot-pager/) | Freeze a work queue's membership at search time — form-carried row keys, tombstones, processed rows stay visible. |
| [`datagrid-bulk-actions/`](datagrid-bulk-actions/) | Select datagrid rows and POST one action against all of them.  |
| [`workflow-actions/`](workflow-actions/)  | Lifecycle transitions as a server-rendered actions region — the action set is the state; stale actions 409. |
| [`sse-updates/`](sse-updates/)            | Server-pushed fragment updates over Server-Sent Events.                 |
| [`sse-toast/`](sse-toast/)                | Server-pushed notifications / domain events via the SSE dispatch bridge. |
| [`unread-badge/`](unread-badge/)          | The notification count in app chrome — self-polling, OOB-corrected, honest at zero. |
| [`undo-delete/`](undo-delete/)            | Undo instead of confirm — soft delete + grace period + tombstone restore. |
| [`file-upload/`](file-upload/)            | Multipart upload with a live progress bar and an out-of-band form reset. |
| [`multi-step-form/`](multi-step-form/)    | The hypermedia wizard — server-owned steps, drafts, and a stepper.       |
| [`chart/`](chart/)                        | Server-sent data table upgraded to an Observable Plot SVG chart. *(needs `installChart` + Plot)* |
