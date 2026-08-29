# async-job — server response contract

Purpose: run work that outlives a request — CSV exports, PDF rendering, batch imports — behind one polling contract: 202 + a job card that polls itself until a terminal state.

## Required client markup

- **A kick-off form**: POST with `data-hx-target="#job"`,
  `data-hx-swap="innerHTML"`, `data-hx-disabled-elt="this"`, and a
  real `action` as the no-JS path.
- **Nothing else.** Every card below is server-rendered.
  `data-hc-job` is a **contract marker only** — no behavior attaches;
  `hc validate` uses it to check the cards.

## The polling shape

The running card **polls itself**:

```html
<div class="hc-card" data-hc-job
     data-hx-get="/exports/j_8f3k" data-hx-trigger="every 2s"
     data-hx-target="this" data-hx-swap="outerHTML">…</div>
```

Three consequences, which are the whole design:

1. **The polling attributes travel with the fragment** — replace the
   card and you replace its behavior. A terminal card (done / failed /
   cancelled / expired) simply carries **no trigger**, and polling
   stops with no JS lifecycle management anywhere.
2. **The server owns the cadence**: each response writes the `every`
   interval it wants into the fragment it returns (back off to
   `every 10s` for a long job, tighten near the end). There is no
   client-side backoff logic to configure.
3. The swap must be **`outerHTML` with `data-hx-target="this"`** — an
   `innerHTML` swap would leave the old trigger on the surviving
   element and the card would poll forever, terminal state included.

## Endpoints

| Method | URL | Returns |
| --- | --- | --- |
| POST | `/exports` | **202** + the running card (the job id is an opaque token; the card's GET URL is the only thing the client learns) |
| GET | `/exports/<id>` | **200** + the current card — running / done / failed / cancelled / expired |
| POST | `/exports/<id>/cancel` | **200** + the cancelled card. Cancelling a finished job is a **no-op 200** (the race is expected), never an error |
| GET | `/exports/<id>/result` | the artifact itself (`Content-Disposition: attachment`) — idempotent; downloading twice yields the same file |

## The cards (states)

- **Running** — `<progress class="hc-progress" value max>` (or
  indeterminate: omit `value`), a **polite text line** with the
  human-readable progress ("12,000 / 30,000 rows"), and a Cancel
  button targeting `closest [data-hc-job]`.
- **Done** — the result as a plain `<a href download>`; optionally a
  "start again" kick-off button.
- **Failed** — the reason (an `hc-alert`, `data-variant="error"`,
  `role="status"`) and a Retry button that POSTs the **kick-off**
  again: retry creates a *new* job, the failed one stays queryable.
  State whether partial work was written ("nothing was written").
- **Cancelled** — a plain confirmation.
- **Expired / unknown id** — a tombstone card ("This job has expired —
  start again"), **HTTP 200**: staleness is a state, not an error
  (the [datagrid-snapshot-pager](../datagrid-snapshot-pager/contract.md)
  stance). Polling an expired id must terminate, so this card carries
  no trigger.

All five states set `data-state` (except running, the default) so
styling and tests can address them; the attribute is descriptive, not
behavioral.

## Progressive enhancement

The kick-off form POSTs normally without JavaScript; the server
renders a full page whose body is the job card **with a
`<meta http-equiv="refresh">` fallback** (or a "check status" link) —
the polling contract degrades to manual refresh, and every state page
remains reachable by its URL.

## Accessibility

- Progress text lives in its own `aria-live="polite"` element — never
  put `aria-live` on the card itself, or every poll re-announces the
  whole card including the buttons.
- The `<progress>` element keeps its native `progressbar` role; give
  it an `aria-label`.
- Terminal states announce once (the polite line changes to "Export
  ready" / "Export failed") — that's the swap doing the announcing;
  no extra wiring.

## Notes

- **htmx `286`**: if you poll a *stable* element (`every` on a
  container that swaps `innerHTML`), htmx stops polling when a
  response returns status 286. The self-replacing shape above doesn't
  need it, but it's the documented alternative for layouts where the
  card must not be replaced.
- **SSE variant**: for jobs with server push already in place, point
  the card at an [sse-updates](../sse-updates/) stream instead of
  `every` — same cards, push instead of poll.
- **A job inbox** (list of my recent jobs) is this recipe applied per
  row + [data-region](../data-region/) for the list itself.
- Kick-off POSTs compose with
  [idempotency-key](../idempotency-key/contract.md) — a double-clicked
  "Export" should yield one job, and the replayed 202 points both
  clicks at the same card.
