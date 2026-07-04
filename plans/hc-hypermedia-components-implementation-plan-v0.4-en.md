# Hypermedia Components Implementation Plan v0.4

Status: **implemented** (PR #1, squash commit `be72271`, 2026-05-28).
The design principles, naming rules, and the §17 Definitions of Done
remain the operative reference; the MVP inventory below is historical
(see CHANGELOG.md for what exists today).

**Project:** Hypermedia Components  
**Short name:** HC  
**Prefix:** `hc-` = Hypermedia Components  
**Repository:** `ingcreators/hypermedia-components`  
**Website target:** `https://ingcreators.com/hypermedia-components/`  
**npm scope:** `@hypermedia-components/*`  
**Documentation stack:** Astro Starlight  
**Documentation language:** English first. Japanese i18n is deferred.  
**Deployment target:** Cloudflare Pages  
**Version:** v0.4 English plan  
**Date:** 2026-05-28

---

## 0. Executive summary

Hypermedia Components is an open source UI kit for server-rendered and hypermedia applications. It provides semantic CSS components, DTCG-token-based themes, htmx-friendly recipes, small behavior helpers, and optional Light DOM macros.


The primary tagline is:

> Semantic components and recipes for hypermedia applications.

The project is developed by ingcreators and published under the following structure:

```text
Website:    https://ingcreators.com/hypermedia-components/
GitHub:     https://github.com/ingcreators/hypermedia-components
npm scope:  @hypermedia-components/*
Prefix:     hc-
Docs:       Astro Starlight
Deploy:     Cloudflare Pages
Language:   English first
```

The project should be docs-first. The documentation must teach not only which classes to use, but also how to structure semantic HTML, how to integrate with htmx, how optional macros expand to plain HTML, and what server response contracts are expected.

---

## 1. Decisions reflected in v0.4

This document updates the English implementation plan and reflects the following decisions.

1. The project name is **Hypermedia Components**.
2. The project prefix is **`hc-`**.
3. The GitHub repository is **`ingcreators/hypermedia-components`**.
4. The documentation site target is **`ingcreators.com/hypermedia-components`**.
5. The npm scope is **`@hypermedia-components`**.
6. The documentation site will use **Astro Starlight**.
7. The documentation will be written in **English first**.
8. Japanese i18n is explicitly deferred to a later phase.
9. Deployment will use **Cloudflare Pages**.
10. The core value is the combination of semantic HTML, DTCG tokens, CSS components, htmx-friendly recipes, small behaviors, optional Light DOM macros, and copyable expanded HTML.

---

## 2. Product definition

### 2.1 What Hypermedia Components is

Hypermedia Components is a semantic UI component system for server-rendered and hypermedia applications.

It provides:

1. **Semantic CSS components**  
   Examples: `hc-button`, `hc-field`, `hc-card`, `hc-table`, `hc-dialog`, `hc-popover`.

2. **DTCG token sources and generated CSS variables**  
   Themes, density modes, state colors, and component-level values are generated from token files.

3. **htmx-ready recipes**  
   Examples: `confirm-action`, `live-search`, `remote-dialog`, `filter-popover`, `data-region`.

4. **Small behavior helpers**  
   Examples: confirm dialog, toast, close dialog, close popover, focus management.

5. **Optional Light DOM macros**  
   Examples: `<hc-confirm-action>`, `<hc-live-search>`, `<hc-remote-dialog>`.

6. **Copyable expanded HTML**  
   Every macro or recipe must document the plain HTML it expands to.

7. **Server response contracts**  
   Recipes must explain what HTML fragments or htmx response headers the server should return.

### 2.2 What Hypermedia Components is not

Hypermedia Components is not:

- a React component library;
- a Vue or Svelte component library;
- a utility-first CSS framework;
- a framework-specific CSS plugin;
- a full data grid;
- a charting library;
- a Shadow DOM widget library;
- a client-side application framework;
- a domain-specific workflow toolkit;
- a replacement for htmx;
- a replacement for server-side templates.

The project must remain HTML-first and framework-agnostic.

### 2.3 Target use cases

The target use cases are:

- server-rendered web applications;
- hypermedia applications;
- admin dashboards;
- internal tools;
- CRUD applications;
- CMS and back-office UIs;
- data-heavy applications;
- form-heavy applications;
- applications that return HTML fragments from the server.

The project should avoid domain-specific naming such as `invoice`, `approval`, `workflow`, `audit`, or `customer` in core APIs. Those concepts may appear in examples, but not as core components.

---

## 3. Design principles

### 3.1 Standard HTML first

Native HTML elements should be the primary building blocks.

```html
<button class="hc-button" data-variant="primary">Save</button>
<input class="hc-input" name="q">
<table class="hc-table">...</table>
<dialog class="hc-dialog">...</dialog>
<div class="hc-popover" popover>...</div>
```

Do not replace standard primitives with custom elements unless there is a strong reason. For example, prefer this:

```html
<button class="hc-button" data-variant="primary">Save</button>
```

Do not make this the primary API:

```html
<hc-button variant="primary">Save</hc-button>
```

### 3.2 Light DOM first

The MVP must not rely on Shadow DOM.

Reasons:

- htmx can process `data-hx-*` attributes in Light DOM naturally.
- Standard form behavior remains intact.
- Server-side validation remains simple.
- Progressive enhancement remains possible.
- Developers can inspect, copy, and modify the final HTML easily.
- Optional macros can expand to normal HTML.

### 3.3 Semantic classes, not utility-first CSS

Hypermedia Components provides semantic CSS components. It should not require long utility-class lists or a utility-first CSS framework.

Prefer semantic component classes and semantic attributes.

```html
<button class="hc-button" data-variant="danger" data-size="sm">
  Delete
</button>
```

Avoid this style as the primary API:

```html
<button class="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium">
  Delete
</button>
```

### 3.4 State belongs in HTML attributes

Use standard attributes, ARIA attributes, and `data-*` attributes for state.

```html
<input class="hc-input" aria-invalid="true" disabled>
<div class="hc-field" data-invalid="true">...</div>
<button class="hc-button" data-loading="true">Saving</button>
```

CSS should style those states. JavaScript should not be required for basic styling.

### 3.5 htmx owns network behavior

Network requests and DOM swaps should be handled by htmx.

```html
<button
  class="hc-button"
  data-variant="primary"
  data-hx-post="/items"
  data-hx-target="#items"
  data-hx-swap="outerHTML">
  Save
</button>
```

The core behavior helpers should not wrap or replace htmx with custom `fetch()` calls.

### 3.6 Behaviors stay small

JavaScript and hyperscript should only be responsible for small local behaviors:

- confirmation dialog;
- toast display;
- closing a dialog after a successful request;
- closing a popover after a successful request;
- focus management;
- keyboard shortcuts;
- macro expansion;
- calling `htmx.process()` after generated content is inserted.

### 3.7 DTCG tokens are the visual source of truth

Visual decisions should be represented as DTCG tokens and exported as CSS custom properties.

The CSS component layer should consume CSS variables, not hard-coded values.

```css
.hc-button {
  min-block-size: var(--hc-button-height);
  padding-inline: var(--hc-button-padding-x);
  border-radius: var(--hc-button-radius);
}
```

### 3.8 Macros are optional

Light DOM custom elements such as `<hc-confirm-action>` are optional convenience macros.

Every macro must have:

- a short syntax;
- the expanded HTML;
- the server response contract;
- accessibility notes;
- an escape hatch that lets the user copy and customize the expanded HTML.

---

## 4. Naming system

### 4.1 Prefix

Use `hc-` consistently across the project.

```text
CSS classes:           hc-button, hc-field, hc-card
Custom elements:       hc-confirm-action, hc-live-search
Data attributes:       data-hc-confirm, data-hc-request
CSS custom properties: --hc-color-bg, --hc-button-height
Events:                hc:toast, hc:confirm, hc:close-dialog
```

### 4.2 CSS class naming

Use component-oriented names.

```text
hc-button
hc-input
hc-select
hc-field
hc-card
hc-alert
hc-badge
hc-table
hc-dialog
hc-popover
hc-toolbar
hc-pagination
hc-data-region
```

Use part-like class names where a component has stable internal structure.

```text
hc-card__header
hc-card__body
hc-card__footer
hc-dialog__header
hc-dialog__body
hc-dialog__footer
hc-field__label
hc-field__message
```

### 4.3 Variants and sizes

Use `data-variant` and `data-size` instead of BEM modifier classes.

```html
<button class="hc-button" data-variant="primary">Save</button>
<button class="hc-button" data-variant="danger">Delete</button>
<button class="hc-button" data-size="sm">Small</button>
```

Recommended common variants:

```text
default
primary
secondary
danger
warning
success
ghost
link
```

Recommended common sizes:

```text
sm
md
lg
```

### 4.4 Data behavior attributes

Use `data-hc-*` for Hypermedia Components behavior.

```html
<button
  class="hc-button"
  data-variant="danger"
  data-hc-confirm="Delete this item?"
  data-hx-delete="/items/123"
  data-hx-trigger="confirmed"
  data-hx-target="closest tr">
  Delete
</button>
```

Do not invent a large opaque DSL such as:

```html
<button data-hc="delete item confirm toast reload">
  Delete
</button>
```

Keep behavior attributes explicit and readable.

---

## 5. Repository architecture

### 5.1 Monorepo structure

Use a pnpm workspace monorepo.

```text
hypermedia-components/
  apps/
    docs/
      astro.config.mjs
      package.json
      src/
        content/
          docs/
        components/
        styles/
      public/

  packages/
    core/
      package.json
      src/
        css/
        js/
        macros/
        tokens/
      dist/

  recipes/
    request-action/
      recipe.html
      expanded.html
      contract.md
    confirm-action/
      recipe.html
      expanded.html
      contract.md
    live-search/
      recipe.html
      expanded.html
      contract.md
    remote-dialog/
      recipe.html
      expanded.html
      contract.md
    filter-popover/
      recipe.html
      expanded.html
      contract.md
    data-region/
      recipe.html
      expanded.html
      contract.md

  examples/
    plain-html/
    htmx/
    java-thymeleaf/
    python-django/
    rails/
    go/

  .github/
    workflows/
      ci.yml
      release.yml

  package.json
  pnpm-workspace.yaml
  README.md
  LICENSE
```

### 5.2 Root package.json

Initial root package:

```json
{
  "name": "hypermedia-components",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "docs:dev": "pnpm --filter @hypermedia-components/docs dev",
    "docs:build": "pnpm --filter @hypermedia-components/docs build",
    "docs:preview": "pnpm --filter @hypermedia-components/docs preview"
  },
  "devDependencies": {}
}
```

### 5.3 pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 5.4 Package naming

The initial package list should be intentionally small.

```text
@hypermedia-components/core
@hypermedia-components/docs  # private, not published
```

Future package candidates:

```text
@hypermedia-components/tokens
@hypermedia-components/css
@hypermedia-components/behaviors
@hypermedia-components/macros
@hypermedia-components/recipes
@hypermedia-components/cli
```

Do not split too early. Start with `@hypermedia-components/core` until the API stabilizes.

---

## 6. Core package plan

### 6.1 Package purpose

`@hypermedia-components/core` should provide:

- generated token CSS;
- base CSS;
- component CSS;
- htmx integration CSS;
- small behavior JavaScript;
- optional Light DOM macro JavaScript;
- source tokens for consumers that want to build their own output.

### 6.2 Proposed package exports

```json
{
  "name": "@hypermedia-components/core",
  "version": "0.0.0",
  "description": "Semantic components and recipes for hypermedia applications.",
  "type": "module",
  "sideEffects": [
    "*.css",
    "dist/**/*.css"
  ],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./css": "./dist/hc.css",
    "./tokens.css": "./dist/hc.tokens.css",
    "./theme.css": "./dist/hc.theme.css",
    "./htmx.css": "./dist/hc.htmx.css",
    "./macros": "./dist/hc.macros.js",
    "./behaviors": "./dist/hc.behaviors.js",
    "./tokens/*": "./src/tokens/*"
  },
  "files": [
    "dist",
    "src/tokens"
  ]
}
```

### 6.3 Suggested dist output

```text
packages/core/dist/
  hc.css
  hc.tokens.css
  hc.theme.css
  hc.htmx.css
  hc.behaviors.js
  hc.macros.js
  index.js
  index.d.ts
```

### 6.4 CDN-friendly usage

The documentation should show a simple CDN-style usage pattern even before choosing a final CDN.

```html
<link rel="stylesheet" href="/assets/hc/hc.css">
<script type="module" src="/assets/hc/hc.behaviors.js"></script>
```

The npm usage should be documented separately.

```js
import '@hypermedia-components/core/css';
import '@hypermedia-components/core/behaviors';
```

---

## 7. Documentation site plan

### 7.1 Documentation stack

Use Astro Starlight for documentation.

Location:

```text
apps/docs
```

Package name:

```json
{
  "name": "@hypermedia-components/docs",
  "private": true
}
```

### 7.2 Documentation language

The documentation must be written in English first.

Do not create Japanese i18n files in the MVP. Japanese i18n can be added later after the English information architecture stabilizes.

Recommended plan:

```text
v0.1: English only
v0.2: English docs expanded
Later: Japanese i18n planning
Later: Japanese translations for key pages
```

### 7.3 Site URL

Target public URL:

```text
https://ingcreators.com/hypermedia-components/
```

Important deployment note:

Cloudflare Pages is usually most straightforward when attached to a domain or subdomain. Publishing under a path such as `/hypermedia-components/` may require a Cloudflare Worker route, a reverse proxy rule, or a redirect/proxy strategy from the main `ingcreators.com` site.

Recommended initial options:

1. **Preferred final URL**  
   `https://ingcreators.com/hypermedia-components/`

2. **Operationally simple preview or fallback URL**  
   `https://hypermedia-components.ingcreators.com/`

3. **Cloudflare Pages default URL**  
   Use only as an implementation detail or preview URL.

### 7.4 Astro config outline

If publishing under `/hypermedia-components/`, set `site` and `base`.

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://ingcreators.com',
  base: '/hypermedia-components',
  integrations: [
    starlight({
      title: 'Hypermedia Components',
      description:
        'Semantic components and recipes for hypermedia applications.',
      editLink: {
        baseUrl:
          'https://github.com/ingcreators/hypermedia-components/edit/main/apps/docs/',
      },
      social: {
        github: 'https://github.com/ingcreators/hypermedia-components',
      },
      sidebar: [
        {
          label: 'Start',
          items: [
            { slug: 'start/introduction' },
            { slug: 'start/installation' },
            { slug: 'start/quick-start' },
            { slug: 'start/philosophy' }
          ]
        },
        { label: 'Fundamentals', autogenerate: { directory: 'fundamentals' } },
        { label: 'Components', autogenerate: { directory: 'components' } },
        { label: 'Recipes', autogenerate: { directory: 'recipes' } },
        { label: 'Tokens', autogenerate: { directory: 'tokens' } },
        { label: 'Integrations', autogenerate: { directory: 'integrations' } },
        { label: 'Reference', autogenerate: { directory: 'reference' } }
      ],
      customCss: [
        './src/styles/custom.css',
        './src/styles/preview.css'
      ]
    })
  ]
});
```

If using a subdomain such as `hypermedia-components.ingcreators.com`, remove `base` or set it to `/`.

### 7.5 Documentation information architecture

Initial documentation structure:

```text
apps/docs/src/content/docs/
  index.mdx

  start/
    introduction.mdx
    installation.mdx
    quick-start.mdx
    philosophy.mdx

  fundamentals/
    semantic-html.mdx
    light-dom.mdx
    naming.mdx
    tokens.mdx
    css-variables.mdx
    htmx.mdx
    hyperscript.mdx

  components/
    button.mdx
    input.mdx
    select.mdx
    field.mdx
    card.mdx
    alert.mdx
    badge.mdx
    table.mdx
    dialog.mdx
    popover.mdx
    toolbar.mdx
    pagination.mdx

  recipes/
    request-action.mdx
    confirm-action.mdx
    live-search.mdx
    remote-dialog.mdx
    filter-popover.mdx
    data-region.mdx
    inline-edit.mdx
    lazy-panel.mdx
    toast.mdx

  tokens/
    overview.mdx
    color.mdx
    typography.mdx
    spacing.mdx
    density.mdx
    component-tokens.mdx

  integrations/
    plain-html.mdx
    htmx.mdx
    hyperscript.mdx
    thymeleaf.mdx
    django.mdx
    rails.mdx
    go.mdx
    razor.mdx

  reference/
    css-classes.mdx
    data-attributes.mdx
    custom-elements.mdx
    css-variables.mdx
    events.mdx
    server-contracts.mdx
```

### 7.6 First 10 documentation pages

The first publishable docs milestone should include these pages.

1. `start/introduction`
2. `start/installation`
3. `start/quick-start`
4. `start/philosophy`
5. `fundamentals/naming`
6. `fundamentals/tokens`
7. `components/button`
8. `components/field`
9. `recipes/confirm-action`
10. `recipes/live-search`

These pages are enough to communicate the project identity.

### 7.7 Page template for components

Every component page should follow this structure.

```text
1. Overview
2. Basic HTML
3. Variants and sizes
4. States
5. htmx usage, if relevant
6. Accessibility notes
7. Theming tokens
8. CSS variables
9. Related recipes
```

### 7.8 Page template for recipes

Every recipe page should follow this structure.

```text
1. Overview
2. Basic usage
3. htmx version
4. data-hc shorthand, if available
5. Optional macro, if available
6. Expanded HTML
7. Server response contract
8. Accessibility notes
9. Progressive enhancement notes
10. Related components
```

### 7.9 Documentation examples

Code examples must prefer `data-hx-*` instead of `hx-*` in primary documentation.

Reason:

- `data-hx-*` is valid HTML data attribute syntax.
- It is often friendlier to template engines and linters.
- It makes the examples look less like a custom syntax.

Example:

```html
<button
  class="hc-button"
  data-variant="primary"
  data-hx-post="/items"
  data-hx-target="#items">
  Save
</button>
```

A note may mention that htmx also supports the shorter `hx-*` form.

---

## 8. Cloudflare Pages deployment plan

### 8.1 Deployment target

Use Cloudflare Pages for the documentation site.

Project source:

```text
GitHub repository: ingcreators/hypermedia-components
App directory:     apps/docs
```

### 8.2 Build settings

Recommended Cloudflare Pages settings:

```text
Framework preset: None or Astro
Root directory:   /           # monorepo root
Build command:    pnpm docs:build
Build output:     apps/docs/dist
Node version:     22 or 24
Package manager:  pnpm
```

If Cloudflare Pages supports setting `apps/docs` as the project root cleanly, an alternative is:

```text
Root directory:   apps/docs
Build command:    pnpm build
Build output:     dist
```

The monorepo-root approach is preferred if docs import files from `packages/core`.

### 8.3 Environment variables

Initial environment variables:

```text
NODE_VERSION=22
PNPM_VERSION=10
```

If a token build needs extra configuration later, add variables only when required.

### 8.4 Build command flow

The root build command should run:

```bash
pnpm install --frozen-lockfile
pnpm docs:build
```

`docs:build` should run:

```bash
pnpm --filter @hypermedia-components/docs build
```

### 8.5 Cloudflare path strategy

Because the target URL is `ingcreators.com/hypermedia-components/`, decide the path strategy before launch.

Options:

#### Option A: Cloudflare Worker proxy

Use a Worker route for:

```text
ingcreators.com/hypermedia-components/*
```

The Worker proxies requests to the Cloudflare Pages project.

Pros:

- keeps the desired path;
- keeps docs under the ingcreators domain;
- allows future routing flexibility.

Cons:

- requires Worker configuration;
- asset paths and base path must be tested carefully.

#### Option B: Subdomain

Use:

```text
https://hypermedia-components.ingcreators.com/
```

Pros:

- simplest Cloudflare Pages setup;
- easier asset paths;
- easy preview and custom domain setup.

Cons:

- not the originally preferred path.

#### Option C: Main site reverse proxy or redirect

Keep docs on a subdomain, and redirect:

```text
https://ingcreators.com/hypermedia-components/
  -> https://hypermedia-components.ingcreators.com/
```

Pros:

- simple and reliable;
- still discoverable from the main ingcreators site.

Cons:

- final URL changes after redirect.

Recommended launch plan:

1. Launch first on a Cloudflare Pages default domain or subdomain.
2. Verify Starlight routing, assets, search, and code examples.
3. Add the final `ingcreators.com/hypermedia-components/` path via Worker proxy or redirect.

### 8.6 Preview deployments

Use Cloudflare Pages preview deployments for pull requests.

Each documentation PR should produce a preview URL. Reviewers should check:

- sidebar structure;
- page rendering;
- code block formatting;
- component previews;
- search indexing after build;
- broken links;
- asset paths under the configured base path.

---

## 9. DTCG token strategy

### 9.1 Token layers

Use four token layers.

```text
1. Primitive tokens
   Raw values: color scales, spacing, radii, font sizes.

2. Semantic tokens
   UI meaning: bg, surface, text, border, action.primary.

3. Component tokens
   Component values: button height, input border, card radius.

4. Theme and density tokens
   Light, dark, high-contrast, comfortable, compact, dense.
```

Component CSS should not consume primitive values directly. It should consume component or semantic variables.

### 9.2 Token directory structure

```text
packages/core/src/tokens/
  primitive.tokens.json
  semantic.tokens.json
  component.tokens.json
  theme.light.tokens.json
  theme.dark.tokens.json
  density.comfortable.tokens.json
  density.compact.tokens.json
  density.dense.tokens.json
```

### 9.3 Generated CSS variables

Generate CSS variables with the `--hc-*` prefix.

```css
:root,
[data-theme="light"] {
  --hc-color-bg: #f9fafb;
  --hc-color-surface: #ffffff;
  --hc-color-text: #111827;
  --hc-color-border: #d0d5dd;
}

[data-theme="dark"] {
  --hc-color-bg: #111827;
  --hc-color-surface: #1f2937;
  --hc-color-text: #f3f4f6;
  --hc-color-border: #374151;
}
```

Density output:

```css
:root,
[data-density="comfortable"] {
  --hc-control-height: 40px;
  --hc-control-padding-x: 16px;
}

[data-density="compact"] {
  --hc-control-height: 32px;
  --hc-control-padding-x: 12px;
}

[data-density="dense"] {
  --hc-control-height: 28px;
  --hc-control-padding-x: 8px;
}
```

### 9.4 Example component tokens

```json
{
  "component": {
    "button": {
      "height": {
        "$type": "dimension",
        "$value": "{semantic.control.height}"
      },
      "paddingX": {
        "$type": "dimension",
        "$value": "{semantic.control.paddingX}"
      },
      "radius": {
        "$type": "dimension",
        "$value": "{semantic.control.radius}"
      },
      "primary": {
        "bg": {
          "$type": "color",
          "$value": "{semantic.color.action.primary.bg}"
        },
        "fg": {
          "$type": "color",
          "$value": "{semantic.color.action.primary.fg}"
        }
      }
    }
  }
}
```

### 9.5 Token build tool

Use Style Dictionary or a small custom build script.

For the MVP, choose the simplest option that can:

- read DTCG-like JSON;
- resolve references;
- output CSS custom properties;
- generate theme files;
- generate density files;
- preserve clear naming.

If Style Dictionary support for the exact DTCG version becomes a blocker, use a small custom transformer for the MVP and revisit the build tool later.

---

## 10. CSS architecture

### 10.1 CSS layers

Use CSS cascade layers.

```css
@layer hc.tokens, hc.base, hc.components, hc.recipes, hc.utilities;
```

Suggested file output:

```text
hc.tokens.css
hc.base.css
hc.components.css
hc.recipes.css
hc.utilities.css
hc.htmx.css
hc.css              # combined bundle
```

### 10.2 Base CSS

Base CSS should normalize only what is necessary.

```css
@layer hc.base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  body {
    margin: 0;
    background: var(--hc-color-bg);
    color: var(--hc-color-text);
    font-family: var(--hc-font-family-sans);
  }
}
```

Do not over-normalize global elements in a way that surprises applications.

### 10.3 Component CSS example

```css
@layer hc.components {
  .hc-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--hc-space-2);
    min-block-size: var(--hc-button-height);
    padding-inline: var(--hc-button-padding-x);
    border: 1px solid var(--hc-button-default-border);
    border-radius: var(--hc-button-radius);
    background: var(--hc-button-default-bg);
    color: var(--hc-button-default-fg);
    cursor: pointer;
  }

  .hc-button[data-variant="primary"] {
    background: var(--hc-button-primary-bg);
    color: var(--hc-button-primary-fg);
    border-color: var(--hc-button-primary-border);
  }

  .hc-button[data-variant="danger"] {
    background: var(--hc-button-danger-bg);
    color: var(--hc-button-danger-fg);
    border-color: var(--hc-button-danger-border);
  }

  .hc-button:disabled,
  .hc-button[aria-disabled="true"] {
    opacity: var(--hc-opacity-disabled);
    cursor: not-allowed;
  }
}
```

### 10.4 Utility CSS

Keep utilities small and semantic.

```css
@layer hc.utilities {
  .hc-sr-only { /* accessible visually hidden utility */ }
  .hc-stack { display: grid; gap: var(--hc-stack-gap, var(--hc-space-3)); }
  .hc-cluster { display: flex; flex-wrap: wrap; gap: var(--hc-cluster-gap, var(--hc-space-2)); }
  .hc-hidden { display: none !important; }
}
```

Do not recreate a utility CSS framework.

---

## 11. Component MVP

### 11.1 MVP component list

Initial CSS components:

```text
hc-button
hc-input
hc-select
hc-textarea
hc-checkbox
hc-radio
hc-field
hc-card
hc-alert
hc-badge
hc-table
hc-dialog
hc-popover
hc-toolbar
hc-pagination
hc-spinner
```

### 11.2 Button

Primary API:

```html
<button class="hc-button">Default</button>
<button class="hc-button" data-variant="primary">Save</button>
<button class="hc-button" data-variant="danger">Delete</button>
<button class="hc-button" data-size="sm">Small</button>
```

Do not create `<hc-button>` for MVP.

### 11.3 Field

Primary API:

```html
<div class="hc-field">
  <label class="hc-field__label" for="email">Email</label>
  <input id="email" class="hc-input" name="email" type="email">
  <p class="hc-field__message">Use your work email.</p>
</div>
```

Invalid state:

```html
<div class="hc-field" data-invalid="true">
  <label class="hc-field__label" for="email">Email</label>
  <input
    id="email"
    class="hc-input"
    name="email"
    type="email"
    aria-invalid="true"
    aria-describedby="email-error">
  <p id="email-error" class="hc-field__message">
    Enter a valid email address.
  </p>
</div>
```

### 11.4 Dialog

Use the standard `<dialog>` element.

```html
<dialog class="hc-dialog" id="edit-dialog">
  <header class="hc-dialog__header">
    <h2 class="hc-dialog__title">Edit item</h2>
  </header>

  <div class="hc-dialog__body">
    ...
  </div>

  <footer class="hc-dialog__footer">
    <button class="hc-button" type="button">Cancel</button>
    <button class="hc-button" data-variant="primary">Save</button>
  </footer>
</dialog>
```

### 11.5 Popover

Use the standard `popover` attribute.

```html
<button class="hc-button" type="button" popovertarget="filter-popover">
  Filter
</button>

<div id="filter-popover" class="hc-popover" popover>
  ...
</div>
```

### 11.6 Table

Keep tables semantic.

```html
<table class="hc-table">
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Status</th>
      <th scope="col">Actions</th>
    </tr>
  </thead>
  <tbody>
    ...
  </tbody>
</table>
```

---

## 12. htmx integration

### 12.1 Use data-hx-* in docs

Primary documentation examples should use `data-hx-*`.

```html
<button
  class="hc-button"
  data-variant="primary"
  data-hx-post="/items"
  data-hx-target="#items"
  data-hx-swap="outerHTML">
  Save
</button>
```

### 12.2 htmx CSS

Provide CSS that understands htmx request state.

```css
@layer hc.recipes {
  .htmx-indicator {
    opacity: 0;
    visibility: hidden;
    transition: opacity 120ms ease;
  }

  .htmx-request .htmx-indicator,
  .htmx-request.htmx-indicator {
    opacity: 1;
    visibility: visible;
  }

  .hc-action.htmx-request,
  .hc-action:has(.htmx-request) {
    cursor: progress;
  }
}
```

### 12.3 Request action recipe

Expanded HTML:

```html
<span class="hc-action">
  <button
    class="hc-button"
    data-variant="primary"
    type="button"
    data-hx-post="/items"
    data-hx-target="#items"
    data-hx-swap="outerHTML"
    data-hx-disabled-elt="this"
    data-hx-indicator="closest .hc-action">
    Save
  </button>

  <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
</span>
```

### 12.4 Server-triggered events

Document server-triggered events as part of recipe contracts.

Example response header:

```text
HX-Trigger: {"hc:toast":{"message":"Saved","variant":"success"}}
```

Client behavior should listen for `hc:toast` and display a toast.

---

## 13. Behavior helpers

### 13.1 Behavior implementation policy

Use vanilla JavaScript as the default behavior implementation.

Reasons:

- works without hyperscript;
- easier for most users to adopt;
- easier to test;
- avoids making hyperscript mandatory.

Hyperscript examples may be documented later as optional alternatives.

### 13.2 Confirm behavior

Primary HTML:

```html
<button
  class="hc-button"
  data-variant="danger"
  data-hc-confirm="Delete this item?"
  data-hx-delete="/items/123"
  data-hx-trigger="confirmed"
  data-hx-target="closest tr">
  Delete
</button>
```

Behavior contract:

1. Intercept click on elements with `data-hc-confirm`.
2. Show a shared confirm dialog.
3. If the user confirms, dispatch a `confirmed` event on the original element.
4. htmx observes `data-hx-trigger="confirmed"` and sends the request.

### 13.3 Toast behavior

Toast region:

```html
<div class="hc-toast-region" data-hc-toast-region></div>
```

Event:

```js
document.body.dispatchEvent(
  new CustomEvent('hc:toast', {
    bubbles: true,
    detail: { message: 'Saved', variant: 'success' }
  })
);
```

### 13.4 Close dialog behavior

A form or request element can opt in:

```html
<form
  class="hc-form"
  data-hx-post="/items/123"
  data-hx-target="closest dialog"
  data-hc-close-dialog-on-success>
  ...
</form>
```

Behavior:

- listen for `htmx:afterRequest`;
- if the request succeeded;
- find the closest dialog;
- call `close()`.

### 13.5 Close popover behavior

```html
<form
  class="hc-form"
  data-hx-get="/items"
  data-hx-target="#results"
  data-hc-close-popover-on-success>
  ...
</form>
```

Behavior:

- listen for `htmx:afterRequest`;
- if the request succeeded;
- find the closest `[popover]`;
- call `hidePopover()`.

---

## 14. Optional Light DOM macros

### 14.1 Macro policy

Macros are optional. They must never be the only documented way to use a pattern.

Each macro must:

- use a custom element name with the `hc-` prefix;
- use Light DOM;
- expand to normal HTML;
- use semantic `hc-*` classes;
- use `data-hx-*` and `data-hc-*` attributes;
- call `htmx.process()` after inserting htmx-enabled markup;
- preserve user-provided content where possible;
- be documented with expanded HTML.

### 14.2 Confirm action macro

Macro syntax:

```html
<hc-confirm-action
  method="delete"
  action="/items/123"
  target="closest tr"
  message="Delete this item?"
  variant="danger">
  Delete
</hc-confirm-action>
```

Expanded HTML:

```html
<span class="hc-action">
  <button
    class="hc-button"
    data-variant="danger"
    type="button"
    data-hx-delete="/items/123"
    data-hx-trigger="confirmed"
    data-hx-target="closest tr"
    data-hx-swap="outerHTML"
    data-hx-disabled-elt="this"
    data-hx-indicator="closest .hc-action"
    data-hc-confirm="Delete this item?">
    Delete
  </button>

  <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
</span>
```

### 14.3 Macro implementation sketch

```js
class HcConfirmAction extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hcUpgraded === 'true') return;
    this.dataset.hcUpgraded = 'true';

    const method = this.getAttribute('method') || 'post';
    const action = this.getAttribute('action') || '';
    const target = this.getAttribute('target') || 'this';
    const swap = this.getAttribute('swap') || 'outerHTML';
    const variant = this.getAttribute('variant') || 'default';
    const message = this.getAttribute('message') || 'Continue?';
    const label = this.innerHTML.trim() || 'Continue';

    this.innerHTML = `
      <span class="hc-action">
        <button class="hc-button" data-variant="${variant}" type="button">
          ${label}
        </button>
        <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
      </span>
    `;

    const button = this.querySelector('button');
    button.setAttribute(`data-hx-${method}`, action);
    button.setAttribute('data-hx-trigger', 'confirmed');
    button.setAttribute('data-hx-target', target);
    button.setAttribute('data-hx-swap', swap);
    button.setAttribute('data-hx-disabled-elt', 'this');
    button.setAttribute('data-hx-indicator', 'closest .hc-action');
    button.setAttribute('data-hc-confirm', message);

    globalThis.htmx?.process(this);
  }
}

customElements.define('hc-confirm-action', HcConfirmAction);
```

This is an implementation sketch only. Production code must escape attributes and preserve pass-through attributes safely.

---

## 15. Recipe system

### 15.1 Recipe directory contract

Each recipe should have:

```text
recipes/<recipe-name>/
  recipe.html       # short recommended usage
  expanded.html     # fully expanded HTML
  contract.md       # server response contract
  README.md         # optional developer notes
```

### 15.2 MVP recipes

```text
request-action
confirm-action
live-search
remote-dialog
filter-popover
data-region
inline-edit
lazy-panel
toast
```

### 15.3 Confirm action contract

Purpose:

- confirm with the user before sending an htmx request.

Required:

- htmx;
- `hc.css`;
- `hc.behaviors.js` for custom confirm UI.

Input:

- `data-hx-delete`, `data-hx-post`, `data-hx-put`, or `data-hx-patch`;
- `data-hx-trigger="confirmed"`;
- `data-hc-confirm`;
- optional `data-hx-target`;
- optional `data-hx-swap`.

Behavior:

1. User clicks the element.
2. Confirm behavior opens a dialog.
3. User confirms.
4. Behavior dispatches `confirmed` on the original element.
5. htmx sends the request.
6. Server returns an HTML fragment or htmx response headers.

Server response:

- return HTML for the target area; or
- return `HX-Trigger` with events such as `hc:toast`; or
- both.

### 15.4 Live search contract

Expanded HTML:

```html
<form class="hc-search" action="/items" method="get" role="search">
  <input
    class="hc-input"
    type="search"
    name="q"
    placeholder="Search"
    data-hx-get="/items"
    data-hx-trigger="input changed delay:300ms, search"
    data-hx-target="#results"
    data-hx-swap="innerHTML"
    data-hx-sync="closest form:replace">

  <button class="hc-button" type="submit">Search</button>
</form>

<div id="results"></div>
```

Server response:

- return HTML for `#results`;
- include empty state markup when there are no results;
- keep the normal form action working without JavaScript.

### 15.5 Remote dialog contract

Trigger:

```html
<button
  class="hc-button"
  data-hx-get="/items/123/edit"
  data-hx-target="#dialog-root"
  data-hx-swap="innerHTML">
  Edit
</button>

<div id="dialog-root" data-hc-remote-dialog-root></div>
```

Server returns:

```html
<dialog class="hc-dialog">
  <header class="hc-dialog__header">
    <h2 class="hc-dialog__title">Edit item</h2>
  </header>

  <form
    class="hc-form"
    data-hx-post="/items/123"
    data-hx-target="closest dialog"
    data-hx-swap="outerHTML">
    ...
  </form>
</dialog>
```

Behavior:

- after swap into the dialog root, find the first dialog and call `showModal()`.

---

## 16. Accessibility policy

### 16.1 General policy

Accessibility must be part of the component contract, not an afterthought.

Each component and recipe page must include accessibility notes.

### 16.2 Native semantics first

Use native elements whenever possible:

- `button` for actions;
- `a` for navigation;
- `form` for form submission;
- `label` for labels;
- `table`, `thead`, `tbody`, `th`, `td` for tabular data;
- `dialog` for modal dialogs;
- `popover` for popover content.

### 16.3 Forms

Field examples must show:

- `label` with `for`;
- matching input `id`;
- `aria-invalid` for invalid fields;
- `aria-describedby` for error messages;
- visible error messages.

### 16.4 Dialogs

Dialog recipes must document:

- how the dialog is opened;
- how it is closed;
- where focus should go;
- whether the dialog is modal;
- how Escape should behave;
- whether the title is visible.

### 16.5 Popovers

Popover recipes must not automatically claim to be menus.

A popover is not necessarily a menu. If a component behaves as a menu, keyboard behavior and roles must be documented separately.

### 16.6 Tables

Table examples must use:

- `thead`;
- `tbody`;
- `th scope="col"`;
- accessible action labels where needed.

---

## 17. Testing and quality strategy

### 17.1 Test levels

Use these test levels.

```text
1. Unit tests
   Token transforms, behavior helpers, macro expansion.

2. DOM tests
   Verify generated HTML and event behavior.

3. Browser tests
   Validate dialog, popover, focus, htmx examples.

4. Visual checks
   Use Storybook-like previews or docs previews for regressions later.

5. Documentation checks
   Broken links, code block syntax, package import examples.
```

### 17.2 Suggested tools

```text
Vitest       - unit and DOM tests
Playwright   - browser tests
Prettier     - formatting
ESLint       - JavaScript/TypeScript linting
Stylelint    - CSS linting, optional
Markdownlint - docs linting, optional
```

### 17.3 Definition of Done for a component

A component is done when:

1. CSS class API is documented.
2. Variants are documented.
3. States are documented.
4. Relevant CSS variables are documented.
5. Accessibility notes are included.
6. At least one example appears in the docs.
7. Token references are used instead of hard-coded styling values where appropriate.
8. The docs site builds successfully.

### 17.4 Definition of Done for a recipe

A recipe is done when:

1. Basic HTML is documented.
2. htmx usage is documented.
3. Optional `data-hc-*` behavior is documented if available.
4. Optional macro is documented if available.
5. Expanded HTML is documented.
6. Server response contract is documented.
7. Progressive enhancement behavior is documented.
8. Accessibility notes are included.
9. Tests exist for behavior helpers or macros, if any.

---

## 18. Initial implementation roadmap

### Week 1 - Foundation

Goals:

- initialize monorepo;
- initialize Astro Starlight docs;
- create Cloudflare Pages project;
- publish first docs preview;
- add initial token files;
- build first CSS bundle;
- write initial README.

Tasks:

```text
- create pnpm workspace
- create apps/docs with Astro Starlight
- create packages/core
- configure TypeScript or JavaScript build
- create initial token JSON files
- generate hc.tokens.css manually or with a small script
- create hc.base.css and hc.button.css
- create docs pages: introduction, installation, quick-start, philosophy
- configure Cloudflare Pages preview deployment
```

Deliverables:

```text
- public docs preview
- README with project positioning
- first working hc-button example
```

### Week 2 - Core components

Goals:

- implement main primitive components;
- document naming and token strategy;
- add form and field patterns.

Tasks:

```text
- hc-button
- hc-input
- hc-select
- hc-textarea
- hc-field
- hc-card
- hc-alert
- hc-badge
- hc-table
- docs for button and field
- docs for naming and tokens
```

Deliverables:

```text
- first usable CSS component set
- docs pages for button and field
- initial component preview style in Starlight
```

### Week 3 - htmx recipes and behaviors

Goals:

- implement htmx integration CSS;
- implement confirm behavior;
- implement toast behavior;
- document first recipes.

Tasks:

```text
- hc.htmx.css
- hc-spinner
- request-action recipe
- confirm-action recipe
- live-search recipe
- toast behavior
- confirm behavior
- docs for confirm-action and live-search
```

Deliverables:

```text
- first meaningful hypermedia recipes
- server response contracts in docs
- behavior helper tests
```

### Week 4 - Macro MVP and release prep

Goals:

- implement optional Light DOM macros;
- document expanded HTML;
- prepare first npm prerelease.

Tasks:

```text
- hc-confirm-action macro
- hc-live-search macro
- hc-remote-dialog macro, optional
- package exports
- npm publishing setup
- release workflow draft
- docs polish
- Cloudflare production deployment
```

Deliverables:

```text
- @hypermedia-components/core@0.0.1-alpha.0
- docs site on Cloudflare Pages
- README and contribution guide
```

---

## 19. Initial backlog

### P0

```text
- Repository README
- License
- pnpm workspace
- Astro Starlight docs app
- Cloudflare Pages deployment
- packages/core scaffold
- hc prefix naming document
- DTCG token source files
- hc.tokens.css generation
- hc.css bundle
- hc-button
- hc-field
- hc-input
- hc-card
- hc-table
- docs: introduction
- docs: installation
- docs: quick-start
```

### P1

```text
- hc-dialog
- hc-popover
- hc-alert
- hc-badge
- hc-toolbar
- hc-pagination
- hc.htmx.css
- hc-spinner
- confirm behavior
- toast behavior
- request-action recipe
- confirm-action recipe
- live-search recipe
- docs: tokens
- docs: naming
- docs: button
- docs: field
- docs: confirm-action
- docs: live-search
```

### P2

```text
- hc-confirm-action macro
- hc-live-search macro
- remote-dialog recipe
- filter-popover recipe
- data-region recipe
- inline-edit recipe
- lazy-panel recipe
- examples/plain-html
- examples/htmx
- integration docs for Thymeleaf, Django, Rails, Go, Razor
```

### P3

```text
- CLI for copying recipes
- package split into tokens/css/macros if needed
- visual regression testing
- Japanese i18n planning
- Japanese translations for key docs pages
```

---

## 20. Release strategy

### 20.1 Versioning

Use SemVer.

Initial releases should be alpha releases.

```text
0.0.1-alpha.0
0.0.1-alpha.1
0.1.0-alpha.0
0.1.0
```

### 20.2 Release requirements for first alpha

First alpha requires:

- `@hypermedia-components/core` published;
- docs deployed;
- README complete;
- license present;
- `hc-button`, `hc-field`, `hc-card`, `hc-table` implemented;
- at least two recipes documented;
- no Japanese docs required.

### 20.3 Changelog

Use a changelog from the beginning.

Recommended file:

```text
CHANGELOG.md
```

Recommended categories:

```text
Added
Changed
Deprecated
Removed
Fixed
Security
```

---

## 21. Governance and contribution

### 21.1 License

Recommended license:

```text
MIT
```

### 21.2 Contribution guide

Add `CONTRIBUTING.md` before the first public call for contributors.

Include:

- project goals;
- scope and non-goals;
- component design rules;
- docs style guide;
- accessibility expectations;
- testing requirements;
- release process.

### 21.3 Issue templates

Recommended issue templates:

```text
Bug report
Component proposal
Recipe proposal
Documentation issue
Accessibility issue
```

### 21.4 Pull request template

PR checklist:

```text
- [ ] I updated the docs.
- [ ] I added or updated examples.
- [ ] I considered accessibility.
- [ ] I added tests where relevant.
- [ ] I did not introduce a utility CSS framework as a requirement.
- [ ] I kept the implementation Light DOM first.
```

---

## 22. Risks and mitigations

### 22.1 Risk: Core APIs become too domain-specific

Mitigation:

- keep core API domain-neutral;
- use examples for domain-specific concepts;
- keep recipe names generic.

### 22.2 Risk: The macro layer becomes a framework

Mitigation:

- keep macros optional;
- document expanded HTML;
- avoid large parameter lists;
- prefer small composable recipes.

### 22.3 Risk: CSS grows too large

Mitigation:

- use tokens;
- keep component CSS focused;
- avoid recreating broad utility-class systems;
- publish modular CSS entry points later if necessary.

### 22.4 Risk: htmx examples become too magical

Mitigation:

- show plain htmx examples first;
- show `data-hc-*` shorthand second;
- show macros last;
- always document server contracts.

### 22.5 Risk: Cloudflare path deployment causes asset issues

Mitigation:

- test with `base: '/hypermedia-components'` early;
- use preview deployments;
- consider subdomain as a fallback;
- avoid hard-coded absolute asset paths.

### 22.6 Risk: DTCG tooling compatibility changes

Mitigation:

- keep token sources simple;
- keep the transform script replaceable;
- document the token naming contract separately from tool implementation.

---

## 23. Initial README draft

```md
# Hypermedia Components

Semantic components and recipes for hypermedia applications.

Hypermedia Components provides semantic CSS components, DTCG-token-based themes, htmx-friendly recipes, small behavior helpers, and optional Light DOM macros for server-rendered applications.

## Goals

- Standard HTML first
- Light DOM first
- Semantic component classes
- DTCG-token-based theming
- htmx-friendly recipes
- Copyable expanded HTML
- Optional Light DOM macros

## Install

```bash
npm install @hypermedia-components/core
```

## Usage

```html
<link rel="stylesheet" href="/assets/hc/hc.css">

<button class="hc-button" data-variant="primary">
  Save
</button>
```

## With htmx

```html
<button
  class="hc-button"
  data-variant="primary"
  data-hx-post="/items"
  data-hx-target="#items">
  Save
</button>
```

## Project status

Hypermedia Components is in early development.
```
```

---

## 24. Minimal vertical slice

The first end-to-end vertical slice should include:

1. DTCG-like tokens.
2. Generated CSS variables.
3. `hc-button` CSS.
4. `hc-field` and `hc-input` CSS.
5. `hc.htmx.css` for request indicators.
6. `confirm-action` behavior.
7. `confirm-action` recipe docs.
8. Astro Starlight docs deployed on Cloudflare Pages.
9. `@hypermedia-components/core` alpha package.

### Example final HTML for the vertical slice

```html
<link rel="stylesheet" href="/assets/hc/hc.css">
<script src="/assets/htmx.min.js"></script>
<script type="module" src="/assets/hc/hc.behaviors.js"></script>

<table class="hc-table">
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Status</th>
      <th scope="col">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr id="item-123">
      <td>Example item</td>
      <td><span class="hc-badge">Active</span></td>
      <td>
        <span class="hc-action">
          <button
            class="hc-button"
            data-variant="danger"
            data-hc-confirm="Delete this item?"
            data-hx-delete="/items/123"
            data-hx-trigger="confirmed"
            data-hx-target="closest tr"
            data-hx-swap="outerHTML"
            data-hx-disabled-elt="this"
            data-hx-indicator="closest .hc-action">
            Delete
          </button>
          <span class="hc-spinner htmx-indicator" aria-hidden="true"></span>
        </span>
      </td>
    </tr>
  </tbody>
</table>
```

This single example demonstrates the core project identity:

- semantic HTML;
- semantic CSS classes;
- htmx integration;
- small behavior helper;
- Light DOM;
- no utility CSS framework requirement;
- no framework requirement.

---

## 25. Final recommendation

Proceed with the following implementation direction.

```text
Project name:       Hypermedia Components
Prefix:             hc-
Website:            ingcreators.com/hypermedia-components
Repository:         ingcreators/hypermedia-components
npm scope:          @hypermedia-components
Docs stack:         Astro Starlight
Deploy:             Cloudflare Pages
Docs language:      English first
Japanese i18n:      Deferred
Initial package:    @hypermedia-components/core
Primary value:      Semantic components + htmx recipes + optional Light DOM macros
```

The first milestone should not try to build many components. It should prove the project model through a small but complete vertical slice: tokens, CSS, docs, Cloudflare deployment, one primitive component, one form component, one htmx recipe, one behavior helper, and one optional macro.

Once that model is clear, additional components and recipes can be added safely.
