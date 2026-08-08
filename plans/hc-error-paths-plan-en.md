# error-paths — session expiry, edit conflicts, and the errors & recovery map

Status: **shipped — PR 1 (plan, #470), PR 3 (session-expiry, #476), PR 4 (edit-conflict, #477), PR 2 (errors & recovery page — reordered last: its links need the recipe pages to exist for the links validator).**
Third theme of the business-app gap analysis (2026-08-08). The recipe
layer is rich on happy paths and thin on the failures every
line-of-business app meets weekly: the session that expired over lunch
(401), the record a colleague saved first (409), and the double-click
that files an order twice. The 422 branch is already blessed
(field-errors / mutating-form); this theme completes the map — reusing
the shipped machinery (`installRemoteDialog`'s swap-opens-dialog root,
`HX-Retarget`, the `htmx:beforeSwap` allowance) so the total new
JavaScript is one ~50-line retry bridge.

## 1. Goal

```html
<!-- One shared error-dialog slot at body end -->
<div id="error-dialog" data-hc-remote-dialog-root
     data-hc-session-expiry></div>

<!-- The allowance (page-level, once — same shape the 422 branch uses) -->
<script type="module">
  document.body.addEventListener('htmx:beforeSwap', (event) => {
    if ([401, 409, 422].includes(event.detail.xhr.status)) {
      event.detail.shouldSwap = true;
      event.detail.isError = false;
    }
  });
</script>
```

An expired session turns any click into a login dialog; logging in
**replays the interrupted request** — the user's action completes
instead of vanishing. A stale save opens a conflict dialog showing both
versions with 上書き / 読み直す. Both arrive by server contract; the
markup above is the entire client setup.

## 2. Verified facts the design stands on

- **`installRemoteDialog` (shipped) opens any `<dialog>` swapped into a
  `[data-hc-remote-dialog-root]` host** (`htmx:afterSwap` →
  `showModal()`). Error dialogs ride the same rail — no new open/close
  machinery.
- **htmx honors `HX-Retarget` + `HX-Reswap` on error responses once
  `htmx:beforeSwap` sets `shouldSwap = true`** (the documented
  field-errors alternative). The server steers its own error UI; the
  client allowance is status-code-only.
- `htmx:beforeSwap`'s `detail` carries the full `requestConfig`
  (verb, path, parameters, headers, source element) — enough to replay
  a request later via `htmx.ajax()` without any fetch wrapper.
- `installCsrfHeader` (shipped) re-reads the token per request
  (`htmx:configRequest`), so a replay after re-login picks up a rotated
  CSRF token for free.
- `hx-sync` + `hx-disabled-elt` + `htmx-indicator` are htmx-native
  double-submit control; the kit's buttons already style
  `[disabled]` states. The gap is documentation, not code.

## 3. Recipe `session-expiry` — 401 + replay (the one new behavior)

### Server contract

| Case | Response |
| --- | --- |
| any protected endpoint, session expired, htmx request | `401` + `HX-Retarget: #error-dialog` + `HX-Reswap: innerHTML` + body = login `<dialog class="hc-dialog">` fragment (form posts to the login endpoint) |
| login form success | `200` + empty fragment (closes nothing — the fragment replaces the dialog markup) + `HX-Trigger: {"hc:sessionrenewed": {}}` |
| login form failure | `422` + the same dialog with field-errors (existing contract) |
| non-htmx (no-JS) request, session expired | `303` to the login page with `?next=` — the classic full-page fallback |

### `installSessionExpiry()` — the replay bridge

New `src/js/session-expiry.js`, root-delegated, idempotent,
uninstaller, no network of its own:

- `htmx:beforeSwap` with `xhr.status === 401` while a
  `[data-hc-session-expiry]` host exists → remember
  `detail.requestConfig` (one slot — the latest interrupted request).
- `hc:sessionrenewed` (dispatched by htmx from the `HX-Trigger`
  header) → close any open dialog in the host, then replay via
  `htmx.ajax(verb, path, { source, values })` from the stored config;
  clear the slot. The replay re-runs the normal pipeline (CSRF fresh,
  indicators, target resolution).
- Never touches `shouldSwap` itself — the allowance stays page-owned
  and status-based (§1), exactly like the 422 branch.
- No i18n (dialog text is server-rendered).

### checks.json

`detect: [data-hc-session-expiry]`; rules: host also carries
`data-hc-remote-dialog-root` (**error** — without it the dialog never
opens); host is not inside a `<form>` (**warn**).

## 4. Recipe `edit-conflict` — optimistic locking, zero new JS

### Required client markup

The edit form carries the version it was rendered from:

```html
<form id="ticket-form" data-hx-put="/tickets/7" data-hx-target="#status">
  <input type="hidden" name="version" value="12">
  …fields…
</form>
```

### Server contract

| Case | Response |
| --- | --- |
| `PUT` with current `version` | mutating-form success contract; the fragment carries the **new** version |
| `PUT` with stale `version` | `409` + `HX-Retarget: #error-dialog` + `HX-Reswap: innerHTML` + a conflict `<dialog>`: a compact theirs/yours diff table, 上書き (button: `data-hx-put="/tickets/7?force=1"` `data-hx-include="#ticket-form"` — carries a fresh hidden `version` from the dialog itself) and 読み直す (button: `data-hx-get="/tickets/7/edit"` `data-hx-target="#ticket-form"` `data-hx-swap="outerHTML"` — discards local edits) |
| `PUT` with `force=1` | overwrite wins; success contract (audit-logging the override is the server's business) |
| no-JS | native POST → `409` full page with the same two choices as links/forms (PRG) |

The dialog's own buttons finish the flow through ordinary htmx — the
recipe is pure composition: hidden version field + `HX-Retarget` +
remote-dialog root + the §1 allowance.

### checks.json

`detect: form input[type="hidden"][name="version"]`; rules: the form
issues a mutating verb (**error**); a `[data-hc-remote-dialog-root]`
exists in the document (**error**); the form has an explicit id
(**warn** — the conflict dialog's 上書き button needs a stable
`data-hx-include` anchor).

## 5. Docs: `fundamentals/errors` — the errors & recovery map

One page (en+ja, + sidebar entries) that turns the scattered branches
into a table — status → what the user sees → which recipe:

- `422` → inline field errors ([field-errors](../recipes/field-errors/))
- `401` → login dialog + replay (session-expiry)
- `409` → conflict dialog (edit-conflict)
- `413` / `5xx` → error toast, no swap (file-upload / lazy-panel notes)
- the **one shared beforeSwap allowance** snippet (supersedes copying it
  per page; existing pages keep working)
- **Double submit**: `hx-sync="closest form:abort"` on the form,
  `data-hx-disabled-elt="find button[type=submit]"`, indicator classes —
  with the "why not disable on click yourself" explanation (htmx
  re-enables on settle, including error paths, which hand-rolled
  disabling gets wrong).

## 6. Public API surface

Additive → patch: 1 export (`installSessionExpiry`), 1 glue attribute
(`data-hc-session-expiry`), 2 recipe contracts, 1 fundamentals page.
No CSS, no i18n keys, no new events (consumes `hc:sessionrenewed`,
which is server-named via `HX-Trigger` and documented in the contract).

## 7. PR split (sequential, no stacking)

### PR 1 — `chore(plans)`: this document.

### PR 2 — `docs(fundamentals): errors & recovery — the status-code map + double-submit hygiene`
- [ ] `fundamentals/errors.mdx` (en+ja) + sidebar entries + cross-links
      from field-errors / mutating-form / htmx integration pages
      (en+ja).
- [ ] CHANGELOG.

### PR 3 — `feat(recipes): session-expiry — 401 login dialog + request replay (installSessionExpiry)`
- [ ] `src/js/session-expiry.js` + registration + manifest claim
      `session-expiry` + `types.smoke.ts`.
- [ ] `test/session-expiry.test.mjs`: capture on 401 (host present /
      absent), replay on `hc:sessionrenewed` via a stubbed
      `window.htmx.ajax`, single-slot semantics, idempotent, uninstall.
- [ ] Recipe scaffolds + docs page (en+ja) + indexes rows (en+ja) +
      behaviors roster rows (en+ja, count bump).
- [ ] Demo API `session-expiry.mjs` (stateless: "expired" threaded via
      a query flag the demo toggles) + tests + `SessionExpiryDemo.astro`.
- [ ] Browser spec + fixture + serve.mjs mock: click → 401 → dialog
      opens → login → original action completes; axe with dialog open.
- [ ] CHANGELOG.

### PR 4 — `docs(recipes): bless edit-conflict (optimistic locking via version + 409 dialog)`
- [ ] Recipe scaffolds (zero new JS) + docs page (en+ja) + indexes rows
      (en+ja).
- [ ] Demo API `edit-conflict.mjs` (two-tab story simulated statelessly:
      version threaded through the form; a "simulate colleague" button
      bumps it) + tests + `EditConflictDemo.astro`.
- [ ] Browser spec + fixture + serve.mjs mock: stale save → dialog →
      上書き wins / 読み直す reloads; axe with dialog open.
- [ ] CHANGELOG; plan Status → shipped.

## 8. Risks / notes

- **Replay is at-most-once and last-wins**: parallel interrupted
  requests keep only the latest (documented; business flows are
  overwhelmingly single-action). The stored config never persists
  across a full page load.
- Replaying a **GET-in-flight** vs a **mutation**: both replay
  identically; mutations were user-intended and never executed (401
  happened before the handler) — replay is safe by definition of the
  contract (the server must 401 *before* acting).
- `htmx.ajax` is htmx's public API — the behavior drives htmx rather
  than wrapping fetch, staying inside the "htmx owns the network" rule.
- The shared `#error-dialog` slot is one per page; nested/parallel
  error dialogs are out of scope (the newest swap wins the slot).
