# HC Road to 1.0 — skip 0.2.0, freeze the proven surface

Status: **proposed** (breaking-debt audit complete, 2026-07-04; the
1.0.0 go/no-go and timing are the maintainer's call).

## 1. The question 0.2.0 exists to answer

Under [`VERSIONING.md`](../VERSIONING.md)'s 0.x rules, a **minor**
(`0.2.0`) is the only release type that may carry breaking changes.
So the road-to-1.0 question is not "what goes in 0.2.0?" but "**is
there any breaking debt worth paying before the freeze?**" — if the
answer is no, 0.2.0 has no reason to exist and 1.0.0 is a promise,
not a project.

## 2. Breaking-debt audit (2026-07-04)

Method: machine-extracted inventories of every public-API category
from `origin/main` (commit `26ad82b`), then a judgment pass over each
list. Reproduce with the commands in §6.

| # | Surface (VERSIONING §) | Inventory | Verdict |
| --- | --- | --- | --- |
| 1 | CSS class names | 84 `hc-*` blocks + their elements | **No debt.** Kebab-case throughout; compound widget names concatenate consistently (`datagrid`, `datepicker`, `dropzone`, `hovercard`, `inputotp`, `multicombobox`, `navmenu`, `sparkline`, `toolbar`) — a real convention, applied uniformly across classes, token groups, and docs slugs. `hc-chips` (list wrapper) is semantically plural on purpose. |
| 2 | Data attributes | 49 `data-hc-*` glue + ~40 bare config/state attrs | **No debt.** Glue follows `data-hc-<behavior>[-<part>]`; config/state uses a small generic vocabulary (`data-variant`, `data-size`, `data-orientation`, `data-side`, `data-state`, …). |
| 3 | Custom properties / tokens | 56 component token groups | **No debt.** Groups mirror component names 1:1 (incl. deliberate reuse: `hc-range` themes via `slider.*`). Generated `--hc-*` names are mechanical from DTCG paths. |
| 4 | JS exports | 50 named exports | **No debt.** 44 `installXxx()` + the i18n five + `registerCodeLanguage` + `version`. Internal utilities (positioning, scoring, tokenizers) are **not** exported and not deep-importable — the exports map has no `./js/*` path, so nothing accidental gets frozen. |
| 5 | Events | 26 `hc:*` names | **Freeze as-is.** Dominant pattern `<component><eventnoun>` (`carouselchange`, `menuselect`, `datagridsort`); three bare past-participles predate it (`confirmed`, `copied`, `tabactivated`) and `hc:toast` is deliberately a command you dispatch *to* the region. Renaming events costs every consumer's `addEventListener` strings more than the inconsistency costs readers — keep them, and hold new events to the dominant pattern (§4). |
| 6 | i18n message keys | 24 keys | **No debt.** Consistent `component.camelCase` throughout. |
| 7 | Package export paths | 20 export map entries | **No debt.** Curated; no wildcard leaks into internals. |
| 8 | Recipe server contracts | 23 recipes | **No debt.** Every recipe ships `contract.md` + machine-checked `checks.json` (`hc validate` green is a CI keystone). |

Corroborating signals:

- `0.1.0 → 0.1.8`: eight releases, **all strictly additive** — the
  deprecation-alias machinery in VERSIONING.md has never been needed.
- The **`experimental` escape hatch is unused**: no docs page is
  flagged, so the whole documented surface is what 1.0 freezes —
  nothing to graduate or evict first.
- The surface survived a real downstream consumer (the TesseraQL
  brief and its follow-up issues) without a single rename request.

**Verdict: zero breaking debt → skip 0.2.0.**

## 3. What 1.0.0 is, then

`1.0.0` = the current surface plus the promise that was already
written down: from 1.0.0 on, breaking changes ship only in majors and
deprecation aliases live for at least one full minor cycle
(VERSIONING.md § "What semver means here"). No code changes required
— the release is CHANGELOG + version bump + tag, like every release
since `v0.1.0`.

Checklist (one PR + one tag):

- [ ] CHANGELOG: promote **Unreleased** into `1.0.0` with a short
      "why now" preamble (surface proven additive across 0.1.x; audit
      2026-07-04 found no breaking debt).
- [ ] VERSIONING.md: swap the 0.x table's framing from "while the
      major version is 0" to past tense; §"From 1.0.0 on" becomes the
      operative rule. Add one line documenting the naming conventions
      in §4 as normative for *new* API.
- [ ] `packages/core/package.json` + `src/js/index.js` `version`
      export → `1.0.0`; tag `v1.0.0` (OIDC publish as usual). The CLI
      versions independently and needs nothing.
- [ ] Docs `reference/versioning` page: mirror the VERSIONING.md edit
      (en + ja in the same PR — the drift check enforces it).
- [ ] CLAUDE.md "Current focus": record the freeze.

## 4. Conventions to document (not change)

Write these into VERSIONING.md (normative for new API, descriptive of
the old):

1. **Compound widget names concatenate** (`inputotp`,
   `multicombobox`, `navmenu`) — across class blocks, token groups,
   and docs slugs. Multi-part *element/part* names stay hyphenated
   (`input-group`, `avatar-group`, `scroll-area`).
2. **New events** follow `hc:<component><eventnoun>` (`…change`,
   `…select`, `…expand`); no new bare past-participles. Existing
   `hc:confirmed` / `hc:copied` / `hc:tabactivated` stay.
3. **List wrappers may pluralize** (`hc-chips`) when the wrapper's
   accessible role is "a list of X"; containers that group controls
   use `-group` (`hc-button-group`, `hc-toggle-group`).

## 5. Explicitly out of scope (unchanged deferrals)

- **Package split** and **Style Dictionary migration** — still no
  demand signal (v0.5 §6 / v0.8 "Explicitly deferred"). Both are
  possible post-1.0 without breakage (additive packages; internal
  tooling swap).
- **F2 `appearance: base-select`** — Chromium-only ("limited",
  webstatus.dev 2026-07-04). When Baseline widens it lands as a
  patch: the dropdown gains styling, the contract doesn't change
  (`hc-select.css` records this).
- Chart pie/donut, client-side data layers, custom scrollbars — the
  standing "explicitly out" list from v0.6/v0.7 carries over.

## 6. Reproducing the audit

```bash
git fetch origin main
# 1 class blocks       git grep -ohE '\.hc-[a-z0-9]+(-[a-z0-9]+)*' origin/main -- 'packages/core/src/css/' | grep -v __ | sort -u
# 2 glue attrs         git grep -ohE 'data-hc-[a-z-]+' origin/main -- packages/core/src | sort -u
#   config/state attrs git grep -ohE '\[data-[a-z-]+' origin/main -- packages/core/src/css | grep -v data-hc- | sort | uniq -c | sort -rn
# 3 token groups       jq -r '.component | keys' packages/core/src/tokens/component.tokens.json
# 4 exports            node -e "import('./packages/core/src/js/index.js').then(m => console.log(Object.keys(m).sort()))"
# 5 events             git grep -ohE "'hc:[a-z]+'" origin/main -- packages/core/src/js | sort -u
# 6 i18n keys          node -e "import('./packages/core/src/js/index.js').then(m => console.log(Object.keys(m.DEFAULT_MESSAGES)))"
# 7 exports map        jq '.exports | keys' packages/core/package.json
# 8 contracts          for r in recipes/*/; do test -f "$r/contract.md" -a -f "$r/checks.json" || echo "$r incomplete"; done
```
