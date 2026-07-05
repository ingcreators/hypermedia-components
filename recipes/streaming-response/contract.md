# streaming-response — server response contract

Purpose: the SSE reply contract — the assistant placeholder appended by chat-messages owns its own stream connection; chunk events append server-rendered HTML into its body while aria-busy defers the announcement, and done/error swap the complete final message over it.

## Required client markup

The placeholder `<li>` (returned by the chat-messages `200`) carries
everything:

- **The connection**: `data-hx-ext="sse"` +
  `data-sse-connect="/chat/messages/<id>/stream"` on the placeholder
  itself. When `done`/`error` outerHTML-swap the `<li>` away, htmx
  closes the EventSource — no cleanup code.
- **The chunk sink**: `.hc-chat__body` with `data-sse-swap="chunk"`
  and `data-hx-swap="beforeend"` — each event's data is appended.
- **The final sink**: `data-sse-swap="done,error"` +
  `data-hx-swap="outerHTML"` on the placeholder — the event data is a
  complete replacement `<li>`.
- **The stop button** (optional): a plain button with
  `data-hx-post="/chat/messages/<id>/stop"`,
  `data-hx-target="closest li"`, `data-hx-swap="outerHTML"` — one
  round trip cancels server-side, swaps in the truncated final
  message, and closes the stream.

## Endpoints

| Method | URL                          | Returns |
| ------ | ---------------------------- | ------- |
| GET    | `/chat/messages/<id>/stream` | `text/event-stream`; see the event table. |
| POST   | `/chat/messages/<id>/stop`   | The truncated final message `<li>` (no `aria-busy`, no `data-state`). |

## Events

| Event   | Data | Effect |
| ------- | ---- | ------ |
| `chunk` | An HTML **text** fragment (server-escaped; single line — SSE frames one line per `data:`) | Appended to `.hc-chat__body` via `beforeend`. Announcements stay deferred: the subtree is `aria-busy`. |
| `done`  | The **complete final message `<li>`** — server-rendered (`hc-code` tokens included), no `aria-busy`, no `data-state`, no stream markup | outerHTML-swaps the placeholder; removing `aria-busy` is what makes the log region announce the finished reply, once. Closes the EventSource (connect element leaves the DOM). |
| `error` | A final `<li data-state="error">` with a retry affordance (no `aria-busy` — the failure is announced) | Same swap and close as `done`. |

## Accessibility

- Chunks land inside an `aria-busy="true"` subtree, so assistive tech
  is not spammed per token; the reply is announced once, complete,
  when `done` (or `error`, or the stop response) removes the
  attribute.
- The stop button is a real button inside the placeholder — reachable
  while the stream runs, gone from the final message.

## Escaping

The server renders and escapes every fragment — `chunk` text
included. No client-side markdown: stream rendered HTML. Keep each
`data:` line single-line (encode newlines into markup, or send more
events).
