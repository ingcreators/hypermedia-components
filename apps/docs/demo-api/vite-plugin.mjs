// Vite plugin: mount the recipe demo API inside `astro dev` /
// `astro preview`, so live demos work locally exactly as they do on
// the Cloudflare Worker (worker.mjs routes the same prefix to the
// same handler).

import { Readable } from 'node:stream';
import { handleDemoApi } from './index.mjs';
import { DOCS_BASE } from './html.mjs';

const PREFIX = '/api/recipes/';

/**
 * Base-strip a middleware URL. Astro's dev server hands connect
 * middlewares the URL with the site base already removed
 * (`/api/recipes/…`); a plain Vite preview server would keep it
 * (`/hypermedia-components/api/recipes/…`). Accept both.
 */
function stripBase(url) {
  return url.startsWith(`${DOCS_BASE}/`) ? url.slice(DOCS_BASE.length) : url;
}

function toWebRequest(req, path) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else if (value !== undefined) headers.set(key, value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`http://${req.headers.host || 'localhost'}${path}`, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: 'half',
  });
}

function middleware() {
  return async (req, res, next) => {
    const path = req.url ? stripBase(req.url) : '';
    if (!path.startsWith(PREFIX)) return next();
    try {
      const response = await handleDemoApi(toWebRequest(req, path));
      if (!response) return next();
      res.statusCode = response.status;
      for (const [key, value] of response.headers) res.setHeader(key, value);
      if (!response.body) {
        res.end();
        return;
      }
      // Stream (SSE demos emit over time). Breaking out of for-await
      // cancels the underlying ReadableStream, which stops the
      // handler's timers when the browser disconnects.
      for await (const chunk of response.body) {
        if (res.destroyed) break;
        res.write(chunk);
      }
      res.end();
    } catch (error) {
      if (res.headersSent) res.destroy(error);
      else next(error);
    }
  };
}

export function demoApiDevPlugin() {
  return {
    name: 'hc-demo-api',
    // Run before Astro's own dev middlewares — its catch-all page
    // handler would otherwise answer /api/recipes/* with the 404 page.
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
  };
}
