# form-safety — unsaved-changes guard + autosave draft recipe

Status: **shipped — PR 1 (plan, #469), PR 2 (installDirtyGuard + unsaved-changes, #474), PR 3 (autosave).**
Second theme of the business-app gap analysis (2026-08-08): losing a
half-filled form is the top complaint class in line-of-business apps —
misclicked navigation, expired sessions, browser crashes. Two layers,
shipped as one client-only behavior + recipe and one zero-JS server
recipe: `installDirtyGuard()` warns before the data is lost;
`autosave` makes the warning mostly moot by persisting drafts as the
user types. Baseline: post-#468 (installFormat/installNormalize), 27
recipes.

## 1. Goal

```html
<!-- Layer 1: warn before losing edits -->
<form data-hc-dirty-guard data-hx-post="/reports/42" data-hx-target="#status">
  …fields…
  <button class="hc-button" data-variant="primary" type="submit">Save</button>
</form>

<!-- Layer 2: drafts save themselves (no new JS — htmx composition) -->
<form id="report" data-hc-dirty-guard data-hx-post="/reports/42" …>
  …fields…
  <div data-hx-post="/reports/42/draft"
       data-hx-include="closest form"
       data-hx-trigger="input from:closest form changed delay:2s"
       data-hx-target="#draft-status" data-hx-swap="innerHTML"></div>
  <p id="draft-status" class="hc-field__hint" aria-live="polite"></p>
  <button class="hc-button" data-variant="primary" type="submit">Save</button>
</form>
```

Editing flips `data-dirty` on the form (style hooks free), closing the
tab prompts, a boosted-nav click asks first, saving cleans the state —
and with the draft wiring, a crash costs at most two seconds of typing.

## 2. Verified facts the design stands on

- **`focusin` precedes the first edit** — snapshotting the baseline on
  the first `focusin` inside a guarded form captures pre-edit values
  without any install-time DOM walk (and htmx swapping in a fresh form
  naturally resets the WeakMap-keyed snapshot).
- **Snapshots serialize via `new FormData(form)`** — which fires
  `formdata`, so installFormat's canonical rewrite applies and
  display-only regrouping never reads as dirty.
- The native `submit` event fires **only after constraint validation
  passes** — flagging "own submission in flight" there prevents the
  classic bug of warning users during their own save navigation.
- **`htmx:afterRequest`'s `detail.elt` is the requesting element** —
  re-snapshot only when `elt === form`, so the form's own save cleans
  the guard while the draft `<div>`'s request (different `elt`)
  deliberately does not: a draft is not the record.
- **`htmx:confirm` fires before every htmx-issued request** and
  supports sync cancellation — the guard hooks it for boosted `<a>`
  navigation only (`detail.elt` is an anchor), asks with
  `window.confirm` (localized via the message catalog), and lets
  `issueRequest(true)` proceed. Modern browsers ignore custom
  `beforeunload` strings, so the tab-close prompt stays generic.
- htmx trigger modifiers `from:closest form` + `changed` + `delay:2s`
  give the debounced autosave loop declaratively — no behavior wraps
  any of it.

## 3. `installDirtyGuard()` — `data-hc-dirty-guard` (recipe `unsaved-changes`)

New `src/js/dirty-guard.js`, root-delegated, idempotent, uninstaller:

- `focusin` in a guarded, unsnapshotted form → snapshot
  (`WeakMap<form, string>`; name=value pairs, file inputs by filename).
- `input` / `change` in a guarded form → compare → toggle
  `data-dirty=""` + dispatch `hc:dirtychange` (`detail: { dirty }`) on
  flips only.
- `beforeunload` (window of the root's document) → prompt when any
  tracked form is dirty and no own-submit is in flight.
- `submit` → mark in-flight (cleared on `htmx:afterRequest` for htmx
  submits; native submits unload the page anyway).
- `htmx:afterRequest` with `detail.elt === form` + 2xx →
  re-snapshot → clean.
- `htmx:confirm` on boosted anchors while something is dirty →
  `window.confirm(msg('dirtyguard.leave'))`.
- i18n: one key, `dirtyguard.leave` (en: "You have unsaved changes.
  Leave this page?" / ja: "保存されていない変更があります。ページを離れますか?").
- Recipe `unsaved-changes` is **client-only** (like `copy` /
  `conditional-fields`): recipe/expanded/contract/checks + docs page
  with a `Demo.astro` inline demo (no demo-api module; amend the
  exceptions sentence in both recipes indexes).

## 4. Server contract (recipe `autosave`)

The draft endpoint is truth for drafts; the record endpoint stays the
[mutating-form](../recipes/mutating-form/) contract. **Zero new JS.**

| Case | Response |
| --- | --- |
| `POST …/draft` (every debounced change) | `200` + a status fragment for `#draft-status` ("下書きを保存しました 12:34" — server-timestamped). Drafts are **not validated**; the server stores the raw pairs. |
| `POST …` (real save, htmx) | mutating-form contract (`200` fragment / `422` field-errors); server deletes the draft on success and the status fragment says so |
| page render with a draft newer than the record | the form renders **from the record** plus an `hc-alert` restore banner: 復元 (`data-hx-get="…/draft" data-hx-target="#report" data-hx-swap="outerHTML"` — returns the form re-rendered from the draft, still unsaved/dirty) / 破棄 (`data-hx-delete="…/draft"`, removes banner) |
| `GET …/draft` (restore) | `200` + the full form fragment rendered from draft values (guard re-snapshots only on save, so the restored form correctly reads as dirty) |
| `DELETE …/draft` | `200` + empty banner slot |
| no-JS | the form posts natively (PRG); drafts simply don't happen — pure enhancement |

Demo API: stateless per the live-demos doctrine — the "draft" is
threaded through the returned fragments' URLs/values, no server state.

## 5. checks.json

- `unsaved-changes` — `detect: form[data-hc-dirty-guard]`; rules: the
  form has a submit control (**warn**); guarded form is not also
  `data-hx-boost="false"`-suppressed (n/a) — keep minimal: submit
  control warn only.
- `autosave` — `detect: [data-hx-trigger*="from:closest form"]`; rules:
  `data-hx-include="closest form"` present (**error**);
  `data-hx-target` resolves (**error**); the target carries
  `aria-live="polite"` (**warn**); trigger contains `changed` and
  `delay:` (**warn** — unthrottled autosave hammers the server).

## 6. Public API surface

Additive → patch: 1 export (`installDirtyGuard`), 1 glue attribute
(`data-hc-dirty-guard`), 1 state attribute (`data-dirty`), 1 event
(`hc:dirtychange`), 1 i18n key (`dirtyguard.leave`), 2 recipe
contracts. No CSS (state attribute is the style hook).

## 7. PR split (sequential, no stacking)

### PR 1 — `chore(plans)`: this document.

### PR 2 — `feat(behaviors): unsaved-changes guard (installDirtyGuard)`
- [ ] `src/js/dirty-guard.js` + registration (behaviors / index /
      bundle-js / manifest claim `unsaved-changes`) + `types.smoke.ts`.
- [ ] i18n: `dirtyguard.leave` in `i18n.js` + `locales/ja.js` +
      `fundamentals/i18n` tables (en+ja).
- [ ] `test/dirty-guard.test.mjs`: snapshot-on-focusin, dirty flip +
      event, clean-on-equal-values, formdata-canonical comparison (a
      grouped display value is not dirty), own-submit flag, htmx
      afterRequest re-snapshot only for `elt === form`, boosted-anchor
      confirm accept/reject, idempotent, uninstall.
- [ ] Recipe `unsaved-changes` (client-only): scaffolds + docs page
      (en+ja, `Demo.astro`) + recipes indexes (en+ja) + exceptions
      sentence + behaviors roster rows (en+ja, count 50).
- [ ] Browser spec + fixture: type → `data-dirty` set; save via mock →
      clean; `beforeunload` prompt asserted via Playwright dialog
      handler; axe.
- [ ] CHANGELOG.

### PR 3 — `docs(recipes): bless autosave (debounced drafts + restore banner)`
- [ ] `recipes/autosave/` scaffolds (zero new JS) + docs page (en+ja) +
      indexes rows (en+ja).
- [ ] Demo API module `autosave.mjs` (stateless draft threading,
      `?fast=1` divisor for the debounce narrative if needed) + tests +
      `AutosaveDemo.astro`.
- [ ] Browser spec + fixture with serve.mjs mock: debounced draft fires
      once for a burst, status updates, restore banner flow, real-save
      cleans the guard.
- [ ] CHANGELOG; plan Status → shipped.

## 8. Risks / notes

- `beforeunload` prompts cannot be styled or localized — the OS/browser
  owns them. The boosted-nav path (htmx:confirm) is where the localized
  message appears; docs must set expectations.
- Playwright can assert the `beforeunload` dialog (`page.on('dialog')`)
  but only Chromium fires it deterministically under automation — the
  spec gates that assertion to Chromium and keeps the rest cross-engine.
- The draft `<div>` carrying `data-hx-post` is request-owning but
  non-interactive — a11y-inert by design; the *status* element carries
  `aria-live`. The axe scan pins this shape.
- Autosaving sensitive fields (passwords) is a server-side decision;
  the contract tells servers to drop `type="password"` names from
  drafts (documented, not engineered).
