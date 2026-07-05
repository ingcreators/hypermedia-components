# HC Chat & Streaming — transcript, attachments, and the SSE reply contract

Status: **shipped** (2026-07-05) — PR-A #359 (`hc-chat` +
`hc-attachment` + `installChatScroll()`), PR-B #360
(`chat-messages`), PR-C #361 (`streaming-response`).

Chat surfaces are where markup-as-wire-contract shines: the server
renders every message as HTML, htmx delivers it, and the stream is
just SSE fragments. Almost every part already exists — avatar,
`hc-code` (server-tokenized code blocks inside replies), scroll-area,
`installCopy()`, dropzone + the file-upload recipe, and the whole SSE
machinery from #283/#284. This plan adds the two missing surfaces and
the two missing wire contracts.

## 1. Components (PR-A)

### `hc-chat` — the transcript

```html
<div class="hc-chat" role="log" aria-label="Conversation">
  <ol class="hc-chat__list" tabindex="0">
    <li class="hc-chat__message" data-role="user">
      <span class="hc-avatar" data-size="sm">…</span>
      <div class="hc-chat__body">…server-rendered HTML…</div>
      <div class="hc-chat__meta"><time datetime="…">14:03</time></div>
    </li>
    <li class="hc-chat__message" data-role="assistant" data-state="streaming" aria-busy="true">
      <div class="hc-chat__body">The first tokens…</div>
    </li>
  </ol>
  <button class="hc-chat__jump hc-button" data-size="sm" type="button">↓ Latest</button>
</div>
```

- Implementation note (axe-driven): `role="log"` lives on the **root div** — the role is not allowed on `<ol>` — and the scrollable list carries `tabindex="0"` (scrollable-region-focusable).
- `data-role="user | assistant | system"` drives bubble alignment and
  colors (new `chat.*` tokens referencing semantic colors). `system`
  renders as a centered muted line.
- `data-state="streaming"` shows a blinking caret via
  `.hc-chat__body::after` (animation removed under
  `prefers-reduced-motion`); `data-state="error"` tints via the status
  tokens.
- **Accessibility is the design**: the root is `role="log"` (implicit polite live region) so *appended complete messages* are announced;
  a streaming placeholder carries **`aria-busy="true"`, which defers
  announcement until the final swap removes it** — the standards
  mechanism for "don't read half a sentence". DOM stays in
  chronological order — **no `column-reverse`** (it reverses reading
  order for AT); following the bottom is the behavior's job.
- Code blocks inside `__body` are plain `hc-code` markup — the
  server-tokenized highlighting story applies unchanged.

### `installChatScroll()` — stick-to-bottom (no network)

Targets `.hc-chat`: keeps `__list` pinned to the bottom while the
reader is at the bottom (threshold ~24 px), releases when they scroll
up, re-pins on new content only if pinned (MutationObserver).
Reflects `data-stuck` on the root — CSS shows `__jump` only when
un-stuck; the behavior wires the jump click. Idempotent, uninstaller,
auto-init roster (the manifest keystone will force the claim).

### `hc-attachment` — file card

```html
<ul class="hc-attachments" aria-label="Attachments">
  <li class="hc-attachment" data-state="uploading">
    <span class="hc-attachment__icon" aria-hidden="true">…svg…</span>
    <span class="hc-attachment__name">report.pdf</span>
    <span class="hc-attachment__size">1.2 MB</span>
    <progress class="hc-progress hc-attachment__progress" max="100" value="40"></progress>
    <button class="hc-attachment__remove" type="button" aria-label="Remove report.pdf">×</button>
  </li>
</ul>
```

Pure CSS (`data-state="uploading | error"`, default settled); the
progress bar is the existing `hc-progress`, driven by
`installUploadProgress()` from the file-upload recipe. The list
wrapper pluralizes per the documented convention (like `hc-chips`).

### PR-A DoD

`chat.*` + `attachment.*` tokens · Vitest for the scroll logic +
Playwright (stick/release/re-stick, jump button, `data-role` axe
sweep incl. dark) · docs pages (en + ja) with the aria-busy story ·
kitchen-sink sections (en + ja) · VRT: transcript on `vrt-data`,
attachments on `vrt-core` (baselines regenerated) · gallery + sidebar
(chat → Data display, attachment → Forms) · CHANGELOG. The generated
manifest picks both up mechanically.

## 2. Recipe: `chat-messages` (PR-B)

The non-streaming round trip — blessed composer + append contract.

- Markup: `hc-chat` + a plain `<form>` composer
  (`data-hx-post="/chat/messages"`,
  `data-hx-target=".hc-chat__list"`, `data-hx-swap="beforeend"`),
  textarea + send button; attachments compose via
  dropzone/`hc-attachment` (documented pointer, wired fully in PR-C
  docs).
- Server contract (table in docs + contract.md): `200` returns the
  **user message `<li>` plus the assistant placeholder `<li>`**
  (`data-state="streaming"`, `aria-busy="true"`) in one fragment; the
  form resets via OOB swap (the file-upload recipe's fresh-form
  pattern); `422` re-renders the composer with field errors
  (`htmx:beforeSwap` standard); the placeholder is what
  streaming-response fills.
- No new JS. checks.json + Playwright test. Scaffold + docs en/ja.

## 3. Recipe: `streaming-response` (PR-C)

The SSE reply contract, riding the vendored htmx SSE extension
exactly like sse-updates.

- The placeholder from chat-messages carries the connection:
  `data-hx-ext="sse"`, `sse-connect="/chat/messages/42/stream"`, and a
  chunk sink: `sse-swap="chunk"`, `data-hx-target="find .hc-chat__body"`,
  `data-hx-swap="beforeend"`.
- Event contract:
  - `chunk` — an HTML text fragment appended to `__body` (the server
    escapes; **no client-side markdown — the server streams rendered
    HTML**, exactly like every other fragment in the kit);
  - `done` — the **complete, final message `<li>`** (server-rendered,
    `hc-code` tokens included, no `aria-busy`/`data-state`) swapped
    over the placeholder (`hx-swap="outerHTML"` on a second sink);
    removing `aria-busy` is what makes AT announce the finished
    message once;
  - `error` — a fragment flipping the placeholder to
    `data-state="error"` with a retry affordance.
- Stop button: swaps the placeholder's connection element out
  (closing the EventSource is htmx-native on element removal) and
  POSTs the cancel to the server.
- Real-SSE Playwright test on the #283 test-server infra (chunks
  arrive → body grows while `aria-busy` holds → done swap clears it);
  attachment composition documented (composer + dropzone +
  upload-progress + this contract, end to end). checks.json, scaffold,
  docs en/ja, CHANGELOG.

## 4. Out of scope

Client-side markdown rendering (the server renders — the kit's core
stance) · virtualized transcripts (paginate with lazy-panel patterns
instead) · WebSocket transport (SSE is the blessed push channel) ·
voice/multimodal composer affordances.

## 5. Order

PR plan → PR-A → PR-B → PR-C, each fresh off origin/main, merged
before the next.
