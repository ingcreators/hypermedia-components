// time behavior — localize server-rendered <time> elements client-side.
//
//   <time datetime="2026-08-08T03:24:00Z" data-hc-time="relative">
//     2026-08-08 03:24 UTC
//   </time>
//
// Servers render UTC (the only honest thing a server clock can say) and
// a machine-readable `datetime` attribute; this behavior rewrites the
// visible text in the *viewer's* zone and language via Intl:
//
//   - `data-hc-time="relative"` — "3 minutes ago" / "3 分前"
//     (Intl.RelativeTimeFormat, `numeric: 'auto'`), refreshed every 30 s
//     by one shared interval per root. The absolute localized timestamp
//     goes into `title` (unless one exists) so hover reveals the exact
//     moment.
//   - `data-hc-time="datetime" | "date" | "time"` — absolute local
//     rendering (Intl.DateTimeFormat); `data-hc-time-style` picks
//     `short | medium | long | full` (default `medium` dates, `short`
//     times).
//
// The `datetime` attribute is never touched (it stays the wire truth),
// the server-rendered text is the no-JS fallback, and an unparseable
// value leaves the element alone. Locale comes from the closest `[lang]`
// (else `en`). Existing content is processed at install time; new
// content is caught by a MutationObserver (the avatar/nav-current
// pattern), which also covers every htmx swap.
//
// installTime() returns an `uninstall` function. Idempotent. No network,
// no i18n keys (Intl carries the language).

const INSTALL_KEY = '__hcTimeUninstall';
const SEL = 'time[data-hc-time]';
const REFRESH_MS = 30000;

const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

function localeOf(el) {
  return el.closest('[lang]')?.getAttribute('lang') || 'en';
}

function absoluteText(date, mode, locale, style) {
  const opts = {};
  if (mode === 'datetime') {
    opts.dateStyle = style || 'medium';
    opts.timeStyle = style || 'short';
  } else if (mode === 'date') {
    opts.dateStyle = style || 'medium';
  } else {
    opts.timeStyle = style || 'short';
  }
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

function relativeText(date, locale) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const magnitude = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (magnitude >= size || unit === 'second') {
      return rtf.format(Math.trunc(seconds / size), unit);
    }
  }
  return rtf.format(0, 'second');
}

function render(el) {
  const mode = el.getAttribute('data-hc-time');
  const raw = el.getAttribute('datetime');
  if (!raw) return;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return;
  const locale = localeOf(el);
  if (mode === 'relative') {
    el.textContent = relativeText(date, locale);
    if (!el.hasAttribute('title')) {
      el.setAttribute(
        'title',
        absoluteText(date, 'datetime', locale, el.getAttribute('data-hc-time-style')),
      );
    }
    return;
  }
  if (mode === 'datetime' || mode === 'date' || mode === 'time') {
    el.textContent = absoluteText(
      date,
      mode,
      locale,
      el.getAttribute('data-hc-time-style'),
    );
  }
}

function renderAll(scope) {
  if (!scope?.querySelectorAll) return;
  scope.querySelectorAll(SEL).forEach(render);
  if (scope.matches?.(SEL)) render(scope);
}

/**
 * Install client-side localization for `time[data-hc-time]` elements:
 * `relative` ("3 minutes ago", auto-refreshing, absolute value in
 * `title`), or `datetime` / `date` / `time` local rendering via Intl.
 * The `datetime` attribute and the server-rendered fallback text define
 * the contract; the behavior only rewrites the visible text.
 *
 * @param {Document|Element} [root]
 *   The root to process and observe. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installTime } from '@hypermedia-components/core';
 * installTime();
 */
export function installTime(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  renderAll(root.body ?? root);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) renderAll(node);
        }
      }
    });
    observer.observe(root.body ?? root, { childList: true, subtree: true });
  }

  const timer = setInterval(() => {
    const scope = root.body ?? root;
    if (!scope?.querySelectorAll) return;
    scope.querySelectorAll('time[data-hc-time="relative"]').forEach(render);
  }, REFRESH_MS);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    observer?.disconnect();
    clearInterval(timer);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
