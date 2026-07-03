# `hc validate` — machine-checked recipe contracts (CLI)

Status: **shipped — engine + checks for every recipe + CI wiring (#286).**
Net-new scope. The recipes' "markup as wire contract" stance is
documented prose today; this plan makes it **machine-checkable**:
`npx @hypermedia-components/cli validate` verifies local HTML against
declarative rules that ship *inside each recipe*. Baseline: CLI `0.1.0`,
16 recipes (post-#284).

## 1. Goal

```bash
npx @hypermedia-components/cli validate src/templates/ [--recipe datagrid-bulk-actions] [--strict]
```

- Scans the given files/directories (`*.html`), detects recipe
  instances, and checks the contract rules: required/forbidden
  attributes, required structure, and reference integrity
  (`data-hx-target="#rows"` must resolve).
- Rules are **data, not code**: each recipe carries an optional
  `recipes/<name>/checks.json` next to its contract. The CLI is a dumb
  engine; the contract's home stays the recipe directory.
- Exit `0` (clean, or warnings without `--strict`), `1` (errors),
  `2` (usage). CI-friendly output with the rule's message and a pointer
  to the contract.

Non-goals (v1): validating template *sources* (JSX/ERB/Jinja — validate
rendered HTML instead, documented), the short-form `hx-*` attribute
spelling (§5), editor/LSP integration, and a docs-site CLI page (the
package README is the CLI's documentation surface today — unchanged).

## 2. Why this shape (alignment with HC principles)

| HC principle | How `validate` honours it |
| --- | --- |
| Markup as wire contract | The contract becomes executable — the same rules a reviewer applies by hand, applied by machine. |
| Contract lives with the recipe | `checks.json` sits next to `contract.md`; `add` copies it; the tarball ships it. One home, no drift. |
| Blessed form is `data-hx-*` | The validator checks the blessed spelling and *warns* on short-form `hx-*` (§5) — reinforcing the docs convention instead of forking it. |
| Recipes are source you own | Validation runs on *your* files, offline, no network. |
| Additive | New subcommand + new optional per-recipe file; `add`/`list` behaviour unchanged (plus `add` now copies `checks.json` when present). |

## 3. What already exists (reused)

- CLI skeleton: `bin/hc-cli.mjs` (parseArgs, exit-code discipline),
  `lib/recipes.mjs` (`recipesRoot()` resolves workspace *and* published
  tarball), `scripts/sync-recipes.mjs` (prepack), vitest suite driving
  the real bin (`execFileSync`).
- 16 recipes with standardized contracts (`Purpose:` line, Required
  client markup sections) — the rules below are transcriptions, not
  inventions.
- A latent CI gap this PR fixes: `packages/cli/test/` exists but the
  unit job only runs core tests. Add the CLI test step.

## 4. Design decisions

### Parser: linkedom (CLI runtime dependency)

Structural validation needs a DOM with real CSS selectors.
**linkedom** (MIT, server-side DOM, already the documented SSR path in
the chart plan) provides `parseHTML` + `querySelectorAll` at minimal
weight. It becomes the CLI's first runtime dependency — the README's
"zero runtime dependencies" claim is updated (the recipes-in-tarball
offline story is unchanged), and the lockfile is committed. `add` /
`list` do not import it (lazy `import()` inside the validate command),
so existing usage paths stay dependency-free at run time.

### `checks.json` schema (v1)

```json
{
  "detect": "form:has([data-hc-datagrid-actions])",
  "contract": "contract.md",
  "rules": [
    {
      "id": "select-all-unnamed",
      "level": "error",
      "message": "The select-all checkbox must not have a name — it would serialize into the bulk POST.",
      "attr": { "on": ".hc-datagrid__head input[type=checkbox]", "name": "name", "assert": "absent" }
    },
    {
      "id": "rows-swap-keeps-tbody",
      "level": "error",
      "message": "Bulk buttons must swap innerHTML into the tbody (keep the element the grid observes).",
      "attr": { "on": "button[data-hx-post]", "name": "data-hx-swap", "assert": "equals", "value": "innerHTML" }
    },
    {
      "id": "target-resolves",
      "level": "error",
      "message": "data-hx-target must point at an element in the document.",
      "resolves": { "on": "button[data-hx-post]", "name": "data-hx-target" }
    },
    {
      "id": "has-count",
      "level": "warn",
      "message": "The bar usually shows the selection count ([data-hc-datagrid-count]).",
      "exists": { "selector": "[data-hc-datagrid-count]", "min": 1 }
    }
  ]
}
```

- `detect` — instances of the recipe in a document. No `--recipe` flag
  → every recipe whose `detect` matches runs; with `--recipe <name>` →
  that recipe must match at least once or it's an error.
- Rule kinds (exactly one per rule):
  - `exists`: `{ selector, min = 1, max? }` — instance-scoped count.
  - `attr`: `{ on, name, assert: "present" | "absent", value?, oneOf?,
    matches? }` — applies to **every** element matching `on` inside the
    instance ("equals"/"oneOf"/"matches" are shorthands via `assert:
    "present"` + the constraint).
  - `resolves`: `{ on, name }` — the attribute's value is a CSS
    selector that must match somewhere in the *document*. htmx's
    extended forms (`this`, `closest …`, `find …`, `next …`,
    `previous …`) are accepted without lookup.
- `level`: `error` fails the run; `warn` reports (fails only with
  `--strict`). Every rule carries a human `message`; output appends the
  recipe's contract path.
- Rules assert only what the contract *requires* — recipe.html and
  expanded.html must both pass their own checks (§7).

### Blessed-spelling stance

The engine matches the `data-hx-*` / `data-sse-*` spellings the docs
bless. A document-level lint emits one **warning** when short-form
`hx-*` / `sse-*` attributes are present ("this validator checks the
`data-` prefixed form"). Honest limitation, documented in the README.

## 5. Checks coverage (v1 — all 16 recipes)

Every recipe ships a `checks.json`; depth follows the contract's
"Required client markup". The high-value trap rules:

| Recipe | Signature rules (level) |
| --- | --- |
| datagrid-bulk-actions | select-all has no `name` (E); row checkboxes `name="ids"` (E); buttons `type=submit` + `name="action"` (E); `data-hx-swap="innerHTML"` + target resolves (E); form has `method`/`action` (E) |
| datagrid-pager | tbody target swap is `innerHTML`, never `outerHTML` (E); pager items target the tbody and it resolves (E) |
| mutating-form | `method`+`action` kept alongside `data-hx-post` (E); in-form error container exists and target resolves (E); `data-hx-disabled-elt` present (W) |
| confirm-action | `data-hc-confirm` pairs with `data-hx-trigger="hc:confirmed"` (E) |
| sse-toast | bridge is `hidden` (E); bridge has `data-sse-swap` (E); bridge sits inside a `data-sse-connect` scope (E) |
| sse-updates | `data-sse-swap` elements inside a `data-sse-connect` scope (E); scope has `data-hx-ext~="sse"` (E) |
| toast | region `data-hc-toast-region` present; `data-position` value oneOf (W) |
| data-region | region has id + `data-hx-get` + trigger includes `from:body` (E) |
| field-errors | summary has `role="alert"` + `data-hc-field-errors` (E); items carry `data-field` (W) |
| request-action / live-search / remote-dialog / filter-popover / inline-edit / lazy-panel / copy / chart | 2–4 rules each from their "Required client markup" sections |

## 6. Distribution & CI

- `RECIPE_FILES` gains `checks.json` — `add` copies it (skip-if-missing
  already handled), `sync-recipes.mjs` ships it in the tarball,
  `validate` loads rules through the same `recipesRoot()` resolution
  (workspace and published tarball both work, offline).
- `.github/workflows/ci.yml` unit job gains
  `pnpm --filter @hypermedia-components/cli test` (fixes the latent
  gap: the existing CLI suite wasn't running in CI).

## 7. Test plan

New `packages/cli/test/validate.test.mjs` (+ fixtures):

1. **Engine semantics** — each rule kind passes/fails as specified;
   instance scoping (two instances in one file report separately);
   `resolves` skips htmx extended selectors; short-form `hx-*` warning.
2. **CLI semantics** — real-bin runs: exit codes (0/1/2), `--strict`
   promotes warnings, `--recipe` not-detected is an error, directory
   scanning finds nested `*.html`.
3. **Self-validation (the keystone)** — for every recipe: `checks.json`
   exists and parses; its `detect` matches the recipe's own
   `expanded.html` *and* `recipe.html`; running the rules against both
   yields **zero errors**. This pins checks ↔ contract ↔ scaffold
   consistency forever — a future recipe edit that breaks its own rules
   fails CI.
4. Broken-fixture cases for the signature traps (named select-all,
   `outerHTML` on the pager tbody, missing `hc:confirmed` trigger,
   unhidden SSE bridge) — each reports its rule id.

## 8. PR split

### PR 1 — this plan (`chore(plans)`).

### PR 2 — `feat(cli): hc validate — machine-checked recipe contracts`

- [ ] `lib/validate.mjs` (engine) + `validate` subcommand in
      `bin/hc-cli.mjs` (+ usage text).
- [ ] `linkedom` dependency (lazy-imported) + lockfile.
- [ ] `recipes/<name>/checks.json` × 16; `RECIPE_FILES` +=
      `checks.json`.
- [ ] Tests (§7) + fixtures; ci.yml unit-job step for the CLI suite.
- [ ] `packages/cli/README.md`: validate section + dependency note;
      `recipes/README.md`: one line that recipes carry machine checks.
- [ ] CHANGELOG (Unreleased / Added, CLI-scoped); plan Status →
      shipped.

npm release: a later `cli-v0.2.0` tag (admin-gated, release.yml/OIDC) —
out of band for this plan.

## 9. Risks / notes

- **Rule expressiveness**: some contracts have conditional structure
  (e.g. mutating-form's confirmed variant). v1 rules assert only
  unconditional requirements; conditional idioms stay prose. The schema
  can grow `when` guards later without breaking existing files
  (unknown rule keys are an error → schema versioning stays honest).
- **`:has()` in `detect`** — linkedom's selector engine must support
  the selectors we use; the self-validation suite (§7.3) catches any
  gap at authoring time, and `detect` can always be rewritten without
  `:has()`.
- **False positives are worse than misses** for adoption: signature
  rules are `error` only where the contract says MUST; stylistic
  guidance is `warn`.
- The CLI's published-tarball path (`packages/cli/recipes/`) is synced
  at prepack; workspace dev uses the repo `recipes/` — both already go
  through `recipesRoot()`.
