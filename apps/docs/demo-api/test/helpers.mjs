// Test helper: call a recipe module's handle() the way the router
// does, without registering it. `pathWithQuery` is the path *inside*
// the recipe namespace (e.g. '/items?q=tab').
export function call(mod, method, pathWithQuery, { htmx = true, headers = {}, body } = {}) {
  const url = new URL(`http://demo.test/api/recipes/_test${pathWithQuery}`);
  const allHeaders = htmx ? { 'hx-request': 'true', ...headers } : headers;
  const request = new Request(url, { method, headers: allHeaders, body });
  const path = url.pathname.slice('/api/recipes/_test'.length) || '/';
  return mod.handle({ request, url, method, path });
}

/** URL-encoded form body for POST/PUT test requests. */
export function form(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const v of value) params.append(key, v);
    else params.append(key, value);
  }
  return params;
}
