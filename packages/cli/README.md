# @hypermedia-components/cli

Copy [Hypermedia Components](https://github.com/ingcreators/hypermedia-components)
recipe scaffolds into your project. Recipes are **source files you own** —
plain HTML plus a documented server contract — not a runtime dependency.

```bash
npx @hypermedia-components/cli list
npx @hypermedia-components/cli add confirm-action
npx @hypermedia-components/cli add live-search --dir src/recipes
```

`add <recipe>` copies three files into `<dir>/<recipe>/`:

| File | What it is |
| --- | --- |
| `recipe.html` | The copyable starting point (semantic classes + `data-hx-*`). |
| `expanded.html` | The same pattern with every shorthand expanded. |
| `contract.md` | The server request/response contract the recipe expects. |

Existing files are never overwritten unless you pass `--force`.

The recipes ship inside this package, so the command works offline. Each
recipe is documented with a live demo on the
[docs site](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/recipes/).

The styles and behaviors the recipes reference come from
[`@hypermedia-components/core`](https://www.npmjs.com/package/@hypermedia-components/core).
