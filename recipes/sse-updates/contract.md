# sse-updates — server response contract

Purpose: server-pushed fragment updates over Server-Sent Events — a
region (feed, status panel, datagrid tbody) that re-renders because the
server said so, not because the user acted. The htmx
[SSE extension](https://htmx.org/extensions/sse/) (vendored, pinned)
owns the `EventSource`; the markup declares the stream and the event
names. Stable under the
[markup versioning policy](../../VERSIONING.md).

## Required client markup

- Load the extension next to htmx (`sse.min.js`, pinned — see the
  htmx integration guide).
- One connection scope per stream:
  `<div data-hx-ext="sse" data-sse-connect="/events">…</div>`.
- Inside it, each element that receives pushes names its events:
  `data-sse-swap="<event>[, <event>…]"`. The message data is swapped
  in honouring the element's `data-hx-swap` (`innerHTML` default;
  `afterbegin` for feeds).
- Optional `data-sse-close="<event>"` on the scope — the server ends
  the stream deliberately with that event ("no more updates").

```html
<div data-hx-ext="sse" data-sse-connect="/events"
     data-sse-close="stream:done">
  <ul id="activity" data-sse-swap="activity:item"
      data-hx-swap="afterbegin">
    <li class="hc-item">…server-rendered current items…</li>
  </ul>

  <section id="status" data-sse-swap="status:panel">
    …server-rendered current status…
  </section>
</div>
```

## The stream

`GET /events` answers `Content-Type: text/event-stream` (the extension
connects `withCredentials: true`, so cookies ride along; a cross-origin
stream needs `Access-Control-Allow-Credentials`). Each update is a
**named** event whose data is a server-rendered fragment on one line:

```text
retry: 5000

event: activity:item
data: <li class="hc-item">Deploy #42 started</li>

event: status:panel
data: <p>All systems normal</p>
```

- **Name events by domain** (`activity:item`, `status:panel`) — names
  are the wire contract, exactly like ids in swap targets.
- The fragment must be the finished HTML for that element's swap
  strategy — the same rule as any htmx response.
- Send `retry:` once to control the browser's reconnect delay.

### Out-of-band fragments — one event, several targets

Message data may carry `data-hx-swap-oob` fragments in addition to the main
fragment; they update their own targets by id, same as the pager and
bulk-actions responses:

```text
event: status:panel
data: <p>All systems normal</p><span id="alert-badge" data-hx-swap-oob="true">3</span>
```

### Datagrid composition

To push rows, put `data-sse-swap` + `data-hx-swap="innerHTML"` on the
`.hc-datagrid__body` tbody and send the full page of rows as the event
data — the **keep-the-tbody** rule from
[datagrid-pager](../datagrid-pager/contract.md) applies unchanged, and
the grid re-applies roles/offsets and re-derives selection after the
swap (so a selection actions bar clears itself, same as after a bulk
action).

## Lifecycle

- Reconnection is native: `EventSource` retries automatically
  (honouring `retry:`), and the extension adds backoff on repeated
  errors. The server must expect reconnects and resend current state
  or tolerate the gap.
- `data-sse-close="<event>"` closes the connection client-side when
  the server sends that event — end streams deliberately instead of
  just dropping them (a dropped stream reconnects).
- `htmx:sseOpen` / `htmx:sseError` / `htmx:sseClose` fire on the scope
  for debugging.

## Progressive enhancement (no JS)

Render the **complete current state** into the initial HTML — the
stream only freshens it. Without JS (or without the extension) the
page is simply as fresh as the last full render; nothing breaks and
nothing shows a "loading…" shell.

## Accessibility

- Pushed updates replace content without moving focus — never wrap a
  live region around the user's current focus target.
- If updates must be announced, put `aria-live="polite"` on the region
  the fragments land in (a feed usually should not announce every
  item; a status line usually should).
- For notifications, prefer the [sse-toast](../sse-toast/) recipe —
  toasts already carry the correct `role="status"` / `role="alert"`.
