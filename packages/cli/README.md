# @hypermedia-components/cli

Copy [Hypermedia Components](https://github.com/ingcreators/hypermedia-components)
recipe scaffolds into your project. Recipes are **source files you own** —
plain HTML plus a documented server contract — not a runtime dependency.

```bash
npx @hypermedia-components/cli list
npx @hypermedia-components/cli add confirm-action
npx @hypermedia-components/cli add live-search --dir src/recipes
npx @hypermedia-components/cli validate src/templates/
```

`add <recipe>` copies the recipe's files into `<dir>/<recipe>/`:

| File | What it is |
| --- | --- |
| `recipe.html` | The copyable starting point (semantic classes + `data-hx-*`). |
| `expanded.html` | The same pattern with every shorthand expanded. |
| `contract.md` | The server request/response contract the recipe expects. |
| `checks.json` | The contract's machine-readable rules (used by `validate`). |

Existing files are never overwritten unless you pass `--force`.

The recipes ship inside this package, so the commands work offline. Each
recipe is documented with a live demo on the
[docs site](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/recipes/).

## `validate` — machine-checked contracts

```bash
npx @hypermedia-components/cli validate <file|dir>… [--recipe <name>] [--strict]
```

`validate` parses your HTML, detects recipe instances automatically, and
checks each one against the recipe's `checks.json`: required and
forbidden attributes, structure, and reference integrity
(`data-hx-target` should point at something). Findings name the rule and
the contract that explains it; the exit code is `1` on contract errors
(`--strict` also fails on warnings), so it slots into CI and pre-commit
hooks. `--recipe <name>` narrows the run to one recipe and errors if no
instance is found.

Two things to know:

- It checks the **blessed `data-hx-*` / `data-sse-*` spelling** the docs
  use, and warns when it sees the short forms.
- Validate **rendered HTML** (fixtures, built pages, server responses) —
  template sources (JSX/ERB/Jinja) are out of scope.

`validate` is powered by [linkedom](https://github.com/WebReflection/linkedom)
(loaded only by `validate`; `add` and `list` don't need it).

## `email` — theme-baked HTML email templates

```bash
npx @hypermedia-components/cli email list
npx @hypermedia-components/cli email eject [--color indigo] [--neutral slate] \
  [--tokens my-theme.json] [--flavor thymeleaf|plain] [--dir <target>] [--force]
```

`email eject` generates HTML email templates with your theme **baked
into inline styles** (email clients strip `var()`, so tokens are
resolved to literals; rem → px). It writes three files into
`<target>/email/`:

| File | What it is |
| --- | --- |
| `hc-email.html` | All fragments — bulletproof button, headings, text, badges, alerts, panel, key-value table, footer. |
| `hc-email-layout.html` | The document shell (preheader, 600px card) with the dark-mode/mobile `<style>` partial baked in. |
| `email-tokens.json` | The resolved light/dark token values, for runtime (per-tenant) theming. |

The **thymeleaf** flavor (default) ships parameterized `th:fragment`s
for Thymeleaf / Spring Boot; **plain** strips the Thymeleaf attributes
for any other engine. `--tokens` accepts a DTCG export from the
[theme builder](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/tokens/theme-builder/)
(accent or full-theme), so a visually-built custom theme regenerates
reproducibly in CI. Each generated file starts with a manifest comment
recording the exact settings and regenerate command. See the
[HTML email guide](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/integrations/html-email/)
for usage from your mail templates.

The styles and behaviors the recipes reference — and the token/email
transforms `email eject` runs — come from
[`@hypermedia-components/core`](https://www.npmjs.com/package/@hypermedia-components/core).
