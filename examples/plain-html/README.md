# plain-html example

A single static HTML page that renders every CSS component shipped by
`@hypermedia-components/core` plus a few buttons that exercise the
`toast` behavior. No template engine, no client-side framework — just
the core CSS and a small `<script type="module">` block.

## Run

```bash
cd examples/plain-html
pnpm start
```

This runs the `prestart` script (which builds
`@hypermedia-components/core` via pnpm's workspace filter) and then
starts a tiny zero-dependency Node server on
[http://localhost:4322/](http://localhost:4322/). The server aliases
`/hc.css`, `/hc.tokens.css`, `/hc.htmx.css`, and `/hc.behaviors.js` to
the workspace `dist` so the page always reflects the current source.

> `examples/*` is intentionally not part of the pnpm workspace
> (per plan §5). The example's `package.json` still works because
> pnpm walks up to find the workspace root when resolving its
> `--filter` flag.

Set `PORT` to use a different port:

```bash
PORT=5000 pnpm start
```

To skip the auto-build and use existing dist artifacts:

```bash
node serve.mjs
```

## What the page demonstrates

- **Buttons** — variants, sizes, `disabled`, `aria-disabled`,
  `[data-loading]`.
- **Inputs and fields** — `hc-input`, `hc-field`, valid and invalid
  states.
- **Badges** — all variants.
- **Alerts** — info / success / warning / danger.
- **Card** — header / body / footer parts.
- **Table** — header band + row hover + status badges.
- **Toolbar** — separator and spacer.
- **Pagination** — `aria-current="page"` and `aria-disabled` boundary.
- **Dialog** — `<dialog>.showModal()`.
- **Popover** — native `popover` attribute.
- **Toast** — buttons dispatch `hc:toast`; the auto-init behavior
  renders the toast and dismisses it.

The **Toggle theme** button in the header switches
`html[data-theme="dark|light"]` so you can verify both palettes
without changing OS settings.

## What it deliberately omits

- No htmx — see [`../htmx`](../htmx) for htmx-driven recipes.
- No build step. The HTML pulls the dist files directly via the local
  server.
