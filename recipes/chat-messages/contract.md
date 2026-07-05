# chat-messages — server response contract

Purpose: chat as a server round trip — the transcript is server-rendered history, the composer is a plain form, and one POST appends both the user's message and the assistant's aria-busy placeholder that streaming-response later fills.

## Required client markup

- **The transcript**: `<div class="hc-chat" role="log" aria-label="…">`
  wrapping `<ol class="hc-chat__list" tabindex="0" id="chat-list">`.
  The `role="log"` root announces appended **complete** messages; the
  list keeps plain list semantics and is keyboard-reachable
  (scrollable region). `installChatScroll()` (auto-init) follows the
  bottom and wires the optional `.hc-chat__jump` button.
- **The composer**, nested as the chat root's last child: a real
  `<form method="post" action="…">` with
  `data-hx-post` (same URL), `data-hx-target="#chat-list"`, and
  `data-hx-swap="beforeend"`. A `<textarea name="prompt">` carries the
  message by native serialization.

## Endpoints

| Method | URL              | Returns |
| ------ | ---------------- | ------- |
| POST   | `/chat/messages` | See the response table. |

## Responses

| Case | Status | Body |
| ---- | ------ | ---- |
| Message accepted | 200 | Three fragments in one body: the user `<li class="hc-chat__message" data-role="user">`, the assistant placeholder `<li … data-role="assistant" data-state="streaming" aria-busy="true" id="reply-<id>">` (both land via `beforeend`), and the fresh composer re-rendered with `data-hx-swap-oob="outerHTML"` (clears the textarea — the file-upload fresh-form pattern). |
| Empty / invalid prompt | 422 | **Only** the out-of-band composer re-render, carrying `data-invalid="true"`, `aria-invalid` + `aria-describedby` on the textarea, and the `.hc-field__message` error. Nothing targets the transcript, so no bogus entry appears. Requires the documented one-time `htmx:beforeSwap` 422 allowance (see the field-errors recipe). |
| No JS (plain form post) | 303 | Redirect back to the conversation page; the server renders the full page including the new exchange. Branch on the `HX-Request` header. |

## Accessibility

- The placeholder's `aria-busy="true"` **defers** the log region's
  announcement — assistive tech reads the reply once, when the final
  swap (streaming-response's `done` event, or your non-streaming
  completion) removes the attribute.
- The composer error follows the field-errors pattern:
  `aria-invalid` + `aria-describedby` pointing at the message.

## Escaping

The server owns rendering: escape the user's prompt before echoing it
into the user `<li>` (the transcript is an HTML sink). No client-side
markdown — assistant replies arrive as server-rendered HTML fragments.
