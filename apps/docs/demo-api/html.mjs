// Shared helpers for the recipe demo API.
//
// Every handler builds web-standard `Response`s from these so the same
// module graph runs on the Cloudflare Worker (production / previews)
// and inside the Vite dev-server middleware (vite-plugin.mjs).

/** Where the docs site is mounted. Used for "back to the docs" links
 * on the no-JS fallback pages (the demo API itself is served with the
 * base already stripped, exactly like the Static Assets binding). */
export const DOCS_BASE = '/hypermedia-components';

/** HTML-escape a value for element content or attribute values. */
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Serialize an `HX-Trigger` payload. Header values are latin-1, so
 * every non-ASCII character is `\uXXXX`-escaped (the toast recipe
 * contract documents this exact transform).
 */
export function hxTrigger(payload) {
  return JSON.stringify(payload).replace(
    /[\u007f-\uffff]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

/** True when the request was issued by htmx (vs. a no-JS form post). */
export function isHtmx(request) {
  return request.headers.get('hx-request') === 'true';
}

/** A text/html fragment response. */
export function html(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

/**
 * A minimal full page for the no-JS fallback branch of a demo
 * endpoint. Deliberately unstyled beyond document semantics — its job
 * is to prove the pattern degrades, not to look like the docs site.
 */
export function page(title, bodyHtml, { status = 200, headers = {} } = {}) {
  const body = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
<p><a href="${DOCS_BASE}/recipes/">Back to the recipes docs</a></p>
</main>
</body>
</html>
`;
  return html(body, { status, headers });
}

/** Plain-text 404 for unknown demo routes. */
export function notFound() {
  return new Response('Demo endpoint not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
