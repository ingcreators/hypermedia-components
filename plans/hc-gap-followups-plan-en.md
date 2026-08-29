# gap-analysis follow-ups — the four runners-up

Status: **plan — PR 1 (this doc), then one PR each, in order:
PR 2 `unread-badge` (recipe), PR 3 `network-retry` (recipe + one
behavior), PR 4 `confirm-page` (template), PR 5 `audit-trail`
(fundamentals guide).**

Sequel to
[`hc-business-flow-contracts-plan-en.md`](hc-business-flow-contracts-plan-en.md)
(2026-08-29), which named these four in its out-of-scope list: the
remaining items from the same line-of-business gap analysis. They are
deliberately heterogeneous — two are wire-contract recipes, one is
templates material, one is a fundamentals guide — which is exactly why
they didn't fit the five-recipe batch:

| Item | Shape | Concern |
| --- | --- | --- |
| `unread-badge` | recipe, zero new JS/CSS | the notification count in app chrome: server-owned, poll- or SSE-freshened, OOB-corrected, honest at zero |
| `network-retry` | recipe + `installNetworkRetry()` | the request that got **no answer at all** — offline, timeout, dropped socket — surfaced with a working Retry |
| `confirm-page` | template, zero new JS/CSS | 入力 → 確認 → 完了 — the three-step confirm flow every JP business app ships |
| `audit-trail` | fundamentals guide | who changed what, when: the append-only trail the other contracts should have been writing all along |

## 1. unread-badge (recipe)

**Goal.** One contract for the little number on the bell: where the
count comes from, how it stays fresh, and why it never lies after the
user's own actions.

```html
<!-- App chrome: the badge fragment polls ITSELF (the async-job rule) -->
<a class="hc-button" data-variant="ghost" href="/notifications"
   id="unread-nav" aria-label="Notifications, 3 unread"
   data-hx-get="/notifications/badge" data-hx-trigger="every 60s"
   data-hx-target="this" data-hx-swap="outerHTML">
  Notifications
  <span class="hc-badge" data-variant="info" aria-hidden="true">3</span>
</a>
```

Contract points:

- **The fragment is the nav item, not the badge.** The badge count and
  the accessible name must change together, so the swap unit is the
  element that carries both (`aria-label` on the link; the badge itself
  is `aria-hidden` presentation — the components/badge stance).
- **Self-swap rule** (async-job): `data-hx-target="this"` +
  `outerHTML`, so the polling attributes travel with the fragment and
  the server owns the cadence (back off by re-rendering `every 300s`
  under load; drop the trigger to stop).
- **Zero renders no badge.** An empty count is silence, not a grey
  "0"; the accessible name says just "Notifications".
- **Cap for display, cap for the name**: past the declared cap render
  `99+` and say "more than 99 unread" — display and accessible name
  tell the same truth.
- **Not a live region.** A count ticking up in app chrome must not
  interrupt a screen-reader user mid-task; the count is discovered on
  focus/navigation. (Announce arrivals, if at all, via the toast the
  event itself raises — sse-toast's job, not the badge's.)
- **The user's own actions correct the badge immediately, out-of-band.**
  Opening the list, mark-one-read, mark-all-read: each response
  carries the re-rendered nav fragment as `data-hx-swap-oob="outerHTML"`.
  The next poll merely confirms it. The classic drift bug — read
  everything, badge says 3 until the minute ticks — is the defect this
  rule exists for.
- **SSE variant, referenced not specified**: on a page with an
  sse-updates scope, the same OOB fragment rides any event's payload
  (the sse-updates page already shows a badge doing exactly this);
  polling stays the base shape because it needs no extension.

checks.json sketch: detect the poller
(`[data-hx-trigger*="every"]:has(.hc-badge)`); error when it doesn't
target `this` / swap `outerHTML` (the self-swap rule); error when the
fragment carries no `id` (the OOB anchor); warn when the badge is not
`aria-hidden` (the name belongs on the nav item); warn when
`aria-live` appears anywhere on the fragment.

Demo API (stateless): the poll URL threads an anchor timestamp
(`/badge?since=<ts>`, the async-job elapsed-time trick) and the count
derives from wall-clock elapsed (one "arrival" every few seconds,
capped); **Mark all read** POSTs and answers with the list plus the
OOB-zeroed nav fragment carrying a fresh anchor. A "99+" flavour
button shows the cap.

## 2. network-retry (recipe + behavior)

**Goal.** Every other error contract assumes an answer arrived. This
one owns the case where none did — airplane mode, a dropped socket, a
timeout — which htmx surfaces as `htmx:sendError` / `htmx:timeout`
and which today the kit (and the page) silently swallows.

**Why this one needs JS.** "The server is the validator and the
narrator" (fundamentals/errors) — but a network failure has no server
response to narrate with. The client must speak this once, and the
existing precedent for client-composed strings is the i18n catalog
(`dirtyguard.leave`, `combobox.error`). The retry itself reuses the
session-expiry replay mechanism verbatim: save
`event.detail.requestConfig`, replay through public
`htmx.ajax(verb, path, { source, values })`.

```html
<!-- One host per page, client-owned, empty in source -->
<div data-hc-network-retry></div>

<!-- Timeouts are opt-in, per element or global (htmx.config.timeout) -->
<form data-hx-post="/orders" data-hx-request='{"timeout": 10000}'>…</form>
```

`installNetworkRetry(root = document)` — auto-init, idempotent,
returns an uninstaller (house pattern, `__hcNetworkRetryUninstall`):

- Listens for `htmx:sendError` and `htmx:timeout` on the root; bails
  unless a `[data-hc-network-retry]` host exists (the session-expiry
  gate pattern).
- Renders into the host an `hc-alert` (`data-variant="error"`,
  `role="status"`): `t('networkRetry.failed')` + a
  `t('networkRetry.retry')` button. Re-renders in place on repeat
  failures — one host, one alert, no stacking (a 2s poller that lost
  the network must not print 30 banners).
- **Retry replays the saved request** — latest-wins single slot, same
  as session-expiry, same FormData→object collapse caveat — via
  `htmx.ajax` with the original `source` if still connected (vanished
  requester: clear the alert, replay nothing).
- **Self-healing**: any subsequent successful `htmx:afterRequest`
  clears the alert and the slot — when a poller's next tick gets
  through, the banner goes away by itself.
- Never touches `fetch()`, never swallows the events, never auto-retries:
  retrying is the *user's* verb (auto-retry of a POST without asking is
  how double orders happen; see composition).

New public surface (all additive → patch): `installNetworkRetry`
export + auto-init entry, `data-hc-network-retry` attribute, i18n keys
`networkRetry.failed` / `networkRetry.retry` (+ `locales/ja.js`,
locales test enforces), manifest `EXPLICIT_CLAIMS` entry, behaviors
reference row EN + ja (and the "57 small behaviors" count → 58),
Vitest suite in the session-expiry style (simulated
`htmx:sendError` / `htmx:timeout` / `htmx:afterRequest` CustomEvents,
faked `window.htmx.ajax`, idempotency + uninstall cases).

Recipe contract points:

- **No-answer ≠ error-response.** 4xx/5xx keep their existing owners
  (the errors map); this recipe fires only when there is no status at
  all. fundamentals/errors gains a "no response at all" row pointing
  here (EN + ja twins, same PR).
- **Timeouts are declared, not defaulted**: the recipe shows
  `data-hx-request='{"timeout": …}'` on the requests that want one and
  documents `htmx.config.timeout` for the page-level version; without
  a timeout only hard send failures fire.
- **Retry composes with idempotency-key**: the replayed POST carries
  the same hidden key, so "did my first click get through before the
  network died?" has a safe answer — this pairing is the recipe's
  marquee composition, in both directions (idempotency-key's docs
  already name the flaky-network resend).
- Progressive enhancement: JS-off means htmx-off means full-page
  navigations — the browser's own network-error page is the handler.

checks.json sketch: detect `[data-hc-network-retry]`; error when the
host is not empty in source (it is client-owned); warn when no
`data-hx-request` timeout nor documented global timeout accompanies
the recipe's form (send-failure-only coverage is legal but worth
flagging); warn when the host nests inside a swap target (a swap would
wipe the banner).

Demo API: `POST /save` answers instantly; `POST /save?down=1` sleeps
past the demo form's 2s declared timeout → the banner appears; Retry
replays honestly (still down — banner re-renders); pressing the
healthy button demonstrates the self-healing clear. Stateless by
construction.

## 3. confirm-page (template)

**Goal.** The 入力 → 確認 → 完了 flow as a full page: review-before-
commit rendered by the server, with the double-submit defence where it
belongs. Composes multi-step-form (the wizard machinery),
idempotency-key (minted at the confirm render), field-errors (422),
hc-stepper, and PRG — zero new JS/CSS, no new recipe: the template IS
the composition.

Page skeleton (one region, whole-region swaps — the multi-step-form
shape):

```html
<div id="flow">
  <ol class="hc-stepper">…入力 → <b aria-current="step">確認</b> → 完了…</ol>

  <!-- CONFIRM step: read-only truth + the values as hidden fields -->
  <form method="post" action="/orders/place"
        data-hx-post="/orders/place"
        data-hx-target="#flow" data-hx-swap="outerHTML">
    <input type="hidden" name="idempotency_key" value="ik_…">
    <input type="hidden" name="amount" value="1200">
    <dl class="hc-dl">
      <dt>Amount</dt><dd>¥1,200</dd>
      …
    </dl>
    <button class="hc-button" name="back" value="1"
            data-hx-post="/orders/confirm">Back</button>
    <button class="hc-button" data-variant="primary" type="submit"
            data-hx-disabled-elt="this">Place order</button>
  </form>
</div>
```

Wiring-map rows (the house 4-column table): stepper = truth rendered
per step (`aria-current="step"`, complete markers server-drawn);
input step = field-errors' 422 re-render; confirm step = **the server
re-renders what it parsed** (the read-back is the point — what the
user confirms is what the server understood, formatted numbers and
all), values ride as hidden fields (stateless, survives PRG-less
fragment flow), the idempotency key is minted **at confirm render**
so Back-and-forward mints a fresh one but double-click on 確定 replays;
Back is a named-button POST re-rendering the form step with values
intact (never `history.back()` — the server owns the truth); complete
step = PRG in the full-page flow, fragment swap in the htmx flow,
replay-safe either way.

Deliverables: `templates/confirm-page.mdx` EN + ja ·
`ConfirmPageTemplateDemo.astro` (borrows the idempotency-key demo-api
namespace? No — this one earns a dedicated handler like
data-grid-page: `demo-api/recipes/confirm-page.mjs` + tests, three
steps threaded statelessly through hidden fields) · sidebar entry in
`astro.config.mjs` (Templates is explicit) · index rows in
`templates/index.mdx` EN + ja (also adding the missing `data-entry`
row — existing drift, noted in the PR) · CHANGELOG.

## 4. audit-trail (fundamentals guide)

**Goal.** Not a component (hc-timeline ships) and not one endpoint (a
recipe would pretend it is one) — a doctrine page:
`fundamentals/audit-trail`, the write-side contract the other recipes
already imply, and the read-side markup to show it.

Sections:

- **The row**: `(actor, verb, entity, entity_id, at, request_id,
  summary, before → after)` — actor from the session, never the form;
  `request_id` correlates with logs; `at` is server clock.
- **When to write — mapped to the shipped contracts**: workflow-
  actions' transition (the 409 loser writes *nothing*), inline-edit /
  datagrid-edit commits (422 writes nothing), bulk actions (one entry
  per row, plus one for the batch), undo-delete (the delete *and* the
  restore), csv-import (the batch entry carries the counts),
  **idempotency-key replays write no second entry** — the trail is
  exactly-once because commits are.
- **Append-only truth**: no UPDATE, no DELETE; corrections are new
  entries; retention is declared policy (mirror of idempotency-key's
  TTL stance).
- **The read side**: `hc-timeline` markup (variants for
  success/warning/error entries), `<time datetime>` +
  `data-hc-time` for localized relative dates, lazy-panel to load the
  trail on the record page, `data-hx-swap="beforeend"` load-more
  (the timeline page's own htmx section), row-detail composition for
  grids, `hc-code` unified diff for large before/after payloads.
- **What it deliberately does not do** (house section): no client-side
  event capture (the server writes the trail from what it *committed*,
  not from what the browser *claims*), no edit history as undo
  (undo-delete is a contract, the trail is a record), no PII scrubbing
  advice beyond "the trail is data — retention policy applies".

Deliverables: `fundamentals/audit-trail.mdx` EN + ja · explicit
sidebar entry (after `errors`, before `writing`) · reading-order
bullet in `fundamentals/index.mdx` EN + ja (also restoring the
missing `print` and `errors` bullets — existing drift, noted in the
PR) · CHANGELOG. No demo (fundamentals pages ship none) and no
`recipes/` scaffold.

## 5. Deliverables per PR (the standard kits)

- PR 2 `unread-badge`: the recipe 4-file kit · demo handler +
  registration + tests · `UnreadBadgeDemo.astro` · docs page EN + ja ·
  recipe index rows (docs EN + ja; `recipes/README.md` stays curated —
  add it there too under Overlays & notifications' spirit) ·
  CHANGELOG.
- PR 3 `network-retry`: everything in §2 — core behavior + tests +
  i18n + manifest claim + behaviors reference EN/ja · recipe kit ·
  demo + tests · docs page EN + ja + index rows ·
  fundamentals/errors row EN + ja · CHANGELOG.
- PR 4 `confirm-page`: §3 list.
- PR 5 `audit-trail`: §4 list.

## 6. Out of scope

- Web Push / Notification-API integration (unread-badge stays a
  fragment contract; push infra is the consumer's).
- Automatic retry with backoff (the behavior retries on the user's
  click only; pollers already self-heal by their next tick).
- Offline queueing / service-worker capture — a different product.
- An audit-trail storage engine or query API — the guide names the
  row and the write points; persistence is the consumer's.
- Undoing anything from the trail (undo-delete owns undo).
