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

## Repository layout

```text
apps/docs/         Astro Starlight documentation site
packages/core/     @hypermedia-components/core
recipes/           htmx recipe sources (recipe.html, expanded.html, contract.md)
examples/          Framework-specific usage examples
```

## Development

```bash
pnpm install
pnpm docs:dev      # http://localhost:4321
pnpm docs:build
```

## Project status

Hypermedia Components is in early development.

## License

MIT
