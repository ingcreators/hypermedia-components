// Cloudflare Worker — docs site entrypoint.
//
// The Astro build under apps/docs/ uses `base: '/hypermedia-components'`,
// so every emitted URL is prefixed (e.g. /hypermedia-components/_astro/foo.css).
// The build output itself is flat — the file lives at apps/docs/dist/_astro/foo.css.
// This Worker strips the base prefix from incoming requests before
// forwarding them to the Static Assets binding so the file resolves.
//
// Workers Static Assets `_redirects` does not support 200 (rewrite)
// status codes, which is why the prefix is handled in JS instead of
// declaratively.
//
// Configured via wrangler.jsonc at the repo root. `run_worker_first`
// is true so bare `/` visits are redirected to the base path before
// the assets binding ever sees them.

const BASE = '/hypermedia-components';

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (req: Request) => Promise<Response> } }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '') {
      return Response.redirect(`${url.origin}${BASE}/`, 301);
    }

    if (url.pathname === BASE) {
      return Response.redirect(`${url.origin}${BASE}/`, 301);
    }

    if (!url.pathname.startsWith(`${BASE}/`)) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    // Strip the base prefix and forward to the Static Assets binding.
    const stripped = url.pathname.slice(BASE.length);
    const innerUrl = new URL(stripped + url.search, url.origin);
    return env.ASSETS.fetch(new Request(innerUrl.href, request));
  },
};
