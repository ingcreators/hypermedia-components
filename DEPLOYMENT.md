# Deployment

This file is the operational runbook for the public docs site. It
captures the manual steps that have to be performed in the Cloudflare
dashboard so a fresh maintainer can re-provision (or audit) the
deployment without re-reading the plan documents.

For the broader design context see:

- [`plans/hc-hypermedia-components-implementation-plan-v0.4-en.md`](plans/hc-hypermedia-components-implementation-plan-v0.4-en.md#8-cloudflare-pages-deployment-plan) — §8 Cloudflare deployment plan (written when Cloudflare still had a distinct "Pages" product).
- [`plans/hc-next-phase-plan-v0.5-en.md`](plans/hc-next-phase-plan-v0.5-en.md#33-provision-cloudflare-pages) — §3.3 release-readiness task.

> **Note on terminology.** Cloudflare has unified the old "Pages"
> product into Workers via **Workers Static Assets**. This runbook
> describes the unified Workers flow. The v0.4 plan still uses
> "Pages" naming — read that section for intent, but trust this file
> for the current steps.

---

## What ships where

| Surface | Source | Build output | Host |
| --- | --- | --- | --- |
| Docs site | `apps/docs/` (Astro Starlight) | `apps/docs/dist/` | Cloudflare Workers (Static Assets) |
| npm package | `packages/core/` | `packages/core/dist/` (via `pnpm pack`) | npmjs.com |

Only the docs site lives on Cloudflare. The npm publish goes through
the separate `release.yml` GitHub Actions workflow.

---

## Repo-side artifacts

These files are checked into the repo and read by Cloudflare at deploy
time. None of them should need editing during a routine deploy.

| File | Purpose |
| --- | --- |
| [`wrangler.jsonc`](wrangler.jsonc) | Worker config. Points the Static Assets binding at `./apps/docs/dist` and wires `worker.mjs` as the entrypoint. |
| [`worker.mjs`](worker.mjs) | Strips the `/hypermedia-components` base path from incoming URLs and forwards to `env.ASSETS.fetch()`. Bare `/` is redirected to `/hypermedia-components/`. |
| [`apps/docs/public/_headers`](apps/docs/public/_headers) | Long-cache for fingerprinted `_astro/*` assets, revalidate for HTML, baseline security headers. Astro copies this into the build root. |

The base-path stripping has to live in JS because Workers Static
Assets `_redirects` does not support `200` (rewrite) status codes —
only true 30x redirects. See the inline comment in [`worker.mjs`](worker.mjs).

---

## Cloudflare Workers — initial setup (one-time)

The launch sequence mirrors v0.5 plan §3.3. Land each step and verify
it before moving to the next.

### Step 1 — Create the Worker

Cloudflare dashboard → **Workers & Pages → Create → Import a
repository (Workers Builds)**:

1. Authorize the Cloudflare GitHub app on `ingcreators/hypermedia-components`.
2. Production branch: `main`.

### Step 2 — "Set up your application" form

| Field | Value |
| --- | --- |
| Project name | `hypermedia-components` |
| Build command | `pnpm install --frozen-lockfile && pnpm -w run docs:build` |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | ☑ checked |
| **Advanced — Non-production branch deploy command** | `npx wrangler versions upload` |
| **Advanced — Path** | *(leave empty / `/`)* — `wrangler.jsonc` lives at the repo root |
| API token | Click **+ Create new token**; accept the default scoped token Cloudflare generates |

Why these values:

- The build command is the one CI also runs ([`.github/workflows/ci.yml`](.github/workflows/ci.yml) `docs` job), so green CI implies a clean Cloudflare build.
- `npx wrangler deploy` reads [`wrangler.jsonc`](wrangler.jsonc) and uploads `worker.mjs` plus the contents of `apps/docs/dist/` as Static Assets.
- `npx wrangler versions upload` creates a preview version (un-promoted), which is exactly what we want for PR previews.
- The **Path** field tells Cloudflare which directory inside the monorepo contains the `wrangler.jsonc`. Ours is at the root, so leave it empty. (The dashboard pre-fills weird values sometimes — clear it.)

Click **Deploy**.

### Step 3 — First deploy

The initial build runs `pnpm install` + `pnpm -w run docs:build` +
`npx wrangler deploy`. When it finishes the site lands at:

```text
https://hypermedia-components.<account>.workers.dev/
```

The Worker redirects `/` → `/hypermedia-components/` (301) and serves
the docs from there. Smoke-check:

- [ ] `https://hypermedia-components.<account>.workers.dev/` redirects to `/hypermedia-components/`.
- [ ] Landing page renders with the Starlight chrome.
- [ ] Sidebar entries link to working pages (no 404).
- [ ] `_astro/*` CSS / JS assets load (open DevTools → Network).
- [ ] Search opens (Pagefind index built; press `Ctrl+K`).
- [ ] Code blocks render with syntax highlighting.
- [ ] Component preview boxes render (CSS from `@hypermedia-components/core` loaded via the workspace dep).
- [ ] A deliberate 404 (e.g. `/hypermedia-components/no-such-page`) shows Astro's 404.html, not Cloudflare's default.

If anything is broken, check the Worker logs in the dashboard before
re-pushing.

### Step 4 — Attach the subdomain

Worker → **Settings → Domains & Routes → Add → Custom domain**:

```text
hypermedia-components.ingcreators.com
```

Cloudflare manages the DNS automatically when `ingcreators.com` is on
Cloudflare. After the cert provisions, repeat the smoke checks against
`https://hypermedia-components.ingcreators.com/`.

This subdomain is the **operational fallback URL** referenced in v0.5
§3.3 step 4.

### Step 5 — Worker route on the canonical path

The canonical URL in the Astro config is
`https://ingcreators.com/hypermedia-components/`. To serve from there,
attach a Worker Route in the `ingcreators.com` zone:

```text
Zone:        ingcreators.com
Route:       ingcreators.com/hypermedia-components/*
Worker:      hypermedia-components
```

No second Worker is needed — the existing one already understands the
`/hypermedia-components/` prefix, so requests routed in on that
pattern flow through unchanged.

(Defer until the rest of the deploy is stable. Plan §8.5 lists this
as the last step.)

---

## Preview deployments (PR previews)

With "Builds for non-production branches" enabled, every pull request
triggers a preview build that runs `npx wrangler versions upload`. The
dashboard surfaces a per-version preview URL of the shape:

```text
https://<version-id>-hypermedia-components.<account>.workers.dev/
```

This satisfies v0.5 §3.3 acceptance criterion 2 with no extra
configuration. Reviewers should check sidebar structure, code
formatting, component previews, search indexing, and broken links on
the preview before approving (v0.4 plan §8.6).

---

## Rollback

Cloudflare keeps every successful version. From the Worker dashboard
choose **Deployments → Rollback to this version** to promote an
earlier build. No CI re-run required.

For an emergency takedown, **Settings → Pause builds** stops new
deploys; **Domains & Routes → ⋯ → Disable** removes the subdomain
attachment.
