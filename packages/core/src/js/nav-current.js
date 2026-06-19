// installNavCurrent — mark the active navigation item by URL (#272).
//
//   <nav class="hc-shell__sidebar" data-hc-nav-current aria-label="Primary">
//     <a class="hc-item" href="/app/explorer">Explorer</a>
//     <a class="hc-item" href="/app/docs">Docs</a>
//     <a class="hc-item" href="/app/docs/coverage">Coverage</a>
//   </nav>
//
// Setting `aria-current="page"` on the link that matches the current URL is
// pure URL logic every app reimplements. This behavior does it from
// declarative markup, so it works under a strict
// `Content-Security-Policy: default-src 'self'` with no inline JS. The kit
// already styles `.hc-item[aria-current]` — this just sets the attribute.
//
// Matching (see `pickCurrent`): among the container's same-origin
// `a[href]`, the link whose pathname equals `location.pathname` wins; else
// the longest link pathname that is a path-segment prefix of it (so a
// section link stays current on its subpages). Root `/` matches only
// exactly, never as a prefix — otherwise Home would always be current.
//
// It re-marks after htmx history navigation (`htmx:pushedIntoHistory`) and
// the back/forward button (`popstate`), so a persistent nav stays correct
// across swaps. Containers added later (htmx swaps) are wired via a
// MutationObserver. Opt-in per container with `data-hc-nav-current` — it
// works on any nav, not only the shell sidebar.
//
// installNavCurrent(root = document) returns an idempotent uninstaller.

const INSTALL_KEY = '__hcNavCurrentUninstall';
const SELECTOR = '[data-hc-nav-current]';

// Collapse a trailing slash so `/foo/` and `/foo` compare equal; the root
// path stays `/`.
function normalizePath(path) {
  if (!path) return '/';
  return path === '/' ? '/' : path.replace(/\/+$/, '');
}

/**
 * Pick the link that represents the current page.
 *
 * Exact pathname match wins outright; otherwise the longest link pathname
 * that is a path-segment prefix of `pathname` (`pathname` starts with
 * `linkPath + "/"`). Root `/` is matched only exactly. Cross-origin links
 * (and `mailto:` / `tel:` whose origin is not `origin`) are ignored.
 *
 * Pure and DOM-light for unit testing: pass any objects exposing an
 * absolute `.href` string.
 *
 * @param {string} pathname    the current `location.pathname`
 * @param {Array<{href: string}>} links
 * @param {string} [origin]    the current `location.origin`; links from a
 *                             different origin are skipped
 * @returns {object|null} the winning link, or null
 */
export function pickCurrent(pathname, links, origin) {
  const here = normalizePath(pathname);
  let best = null;
  let bestLen = -1;
  for (const link of links) {
    let url;
    try {
      url = new URL(link.href, origin || undefined);
    } catch {
      continue; // unparseable href
    }
    if (origin && url.origin !== origin) continue; // external / mailto / tel
    const path = normalizePath(url.pathname);

    let match = false;
    if (path === here) match = true;
    else if (path !== '/' && here.startsWith(`${path}/`)) match = true; // root: exact only

    if (match && path.length > bestLen) {
      best = link;
      bestLen = path.length;
    }
  }
  return best;
}

/**
 * Install the active-nav-item behavior on every `[data-hc-nav-current]`
 * container. Marks the best-matching `a[href]` with `aria-current="page"`
 * on load, after htmx history navigation, and on back/forward; clears the
 * link it previously set so exactly one is current.
 *
 * @param {Document|Element} [root]
 * @returns {() => void} an idempotent uninstaller.
 */
export function installNavCurrent(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const view = root.defaultView || (typeof window !== 'undefined' ? window : null);
  const containers = new Set();
  const marked = new Map(); // container -> the link this behavior set

  function markOne(container) {
    const loc = view ? view.location : (typeof location !== 'undefined' ? location : null);
    if (!loc) return;
    const links = [...container.querySelectorAll('a[href]')];
    const winner = pickCurrent(loc.pathname, links, loc.origin);
    const prev = marked.get(container);
    if (prev && prev !== winner && prev.getAttribute('aria-current') === 'page') {
      prev.removeAttribute('aria-current');
    }
    if (winner) {
      winner.setAttribute('aria-current', 'page');
      marked.set(container, winner);
    } else {
      marked.delete(container);
    }
  }

  function attach(container) {
    if (containers.has(container)) return;
    containers.add(container);
    markOne(container);
  }

  function remark() {
    for (const container of containers) markOne(container);
  }

  for (const container of root.querySelectorAll(SELECTOR)) attach(container);

  // Install-level history listeners: re-mark when the URL changes under a
  // persistent nav. htmx fires `htmx:pushedIntoHistory` on the body.
  view?.addEventListener('popstate', remark);
  const body = root.body || root;
  body.addEventListener('htmx:pushedIntoHistory', remark);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.(SELECTOR)) attach(node);
          node.querySelectorAll?.(SELECTOR).forEach((el) => attach(el));
        }
      }
    });
    observer.observe(root.body ?? root, { childList: true, subtree: true });
  }

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    view?.removeEventListener('popstate', remark);
    body.removeEventListener('htmx:pushedIntoHistory', remark);
    if (observer) observer.disconnect();
    for (const link of marked.values()) {
      if (link.getAttribute('aria-current') === 'page') link.removeAttribute('aria-current');
    }
    marked.clear();
    containers.clear();
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
