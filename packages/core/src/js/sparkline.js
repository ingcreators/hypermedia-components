// installSparkline — render a tiny inline trend chart from a numeric series
// (issue #254).
//
//   <span class="hc-sparkline" data-values="0.7,0.74,0.8,0.78,0.82"
//         aria-label="SQL line coverage trend"></span>
//
// The behavior reads `data-values` and draws an inline `<svg>` polyline with
// the DOM API (createElementNS — no innerHTML, no string-as-markup), so it is
// safe under a strict `default-src 'self'` CSP. It has NO charting
// dependency: the point maths is a few lines, unlike installChart() which
// upgrades a data table with Observable Plot.
//
// The rendered SVG is the same shape a server may emit directly (the
// "markup convention" — see the docs), so both paths share one CSS contract:
//
//   <span class="hc-sparkline" role="img" aria-label="…">
//     <svg class="hc-sparkline__svg" viewBox="0 0 100 100"
//          preserveAspectRatio="none" aria-hidden="true" focusable="false">
//       <polygon class="hc-sparkline__area" points="…" />   <!-- data-area -->
//       <polyline class="hc-sparkline__line" points="…" />
//     </svg>
//   </span>
//
// Attributes:
//   - data-values  — required; comma-separated numbers (e.g. "0.7,0.74,0.8").
//   - data-area    — present → fill the area under the line.
//   - data-min / data-max — override the value domain (default: the series
//     min/max). Useful to pin a 0..1 ratio or share a scale across rows.
//   - data-variant — CSS only (success / warning / error trend colour).
//
// Accessibility: when the host carries an accessible name (`aria-label` /
// `aria-labelledby`) the behavior sets `role="img"`; otherwise the sparkline
// is decorative and marked `aria-hidden`. The inner SVG is always hidden from
// the accessibility tree.
//
// A host that already contains an `.hc-sparkline__svg` (server-rendered via
// the markup convention) is left untouched. installSparkline(root = document)
// is idempotent and returns an uninstaller; charts swapped in by htmx render
// on `htmx:load`.

const INSTALL_KEY = '__hcSparklineUninstall';
const SVG_NS = 'http://www.w3.org/2000/svg';

// Normalized viewBox. Inset the top/bottom so the stroke and the peaks/troughs
// keep a little breathing room inside the box.
const VB = 100;
const PAD = 8;

function parseValues(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => Number.parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function parseBound(raw) {
  const n = Number.parseFloat(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

// Map values → "x,y x,y …" points across the normalized viewBox.
function pointsFor(values, minOverride, maxOverride) {
  const n = values.length;
  const min = minOverride != null ? minOverride : Math.min(...values);
  const max = maxOverride != null ? maxOverride : Math.max(...values);
  const span = max - min;
  const usable = VB - PAD * 2;

  const y = (v) => {
    if (span === 0) return VB / 2; // flat series → centre line
    const t = (v - min) / span; // 0 (min) … 1 (max)
    return PAD + (1 - t) * usable;
  };

  if (n === 1) {
    const yy = y(values[0]);
    return `0,${yy} ${VB},${yy}`;
  }
  return values
    .map((v, i) => `${(i / (n - 1)) * VB},${y(v)}`)
    .join(' ');
}

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function render(host) {
  // Respect a server-rendered SVG (markup convention) or a prior render.
  if (host.querySelector('.hc-sparkline__svg')) return;

  const values = parseValues(host.dataset.values);
  if (!values.length) {
    // Nothing to draw — keep it out of the accessibility tree.
    host.setAttribute('aria-hidden', 'true');
    return;
  }

  const points = pointsFor(
    values,
    parseBound(host.dataset.min),
    parseBound(host.dataset.max),
  );

  const svg = svgEl('svg', {
    class: 'hc-sparkline__svg',
    viewBox: `0 0 ${VB} ${VB}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  if (host.dataset.area != null) {
    svg.appendChild(
      svgEl('polygon', {
        class: 'hc-sparkline__area',
        points: `${points} ${VB},${VB} 0,${VB}`,
      }),
    );
  }

  svg.appendChild(svgEl('polyline', { class: 'hc-sparkline__line', points }));
  host.appendChild(svg);

  // Decorative unless the consumer gave it an accessible name.
  if (host.getAttribute('aria-label') || host.getAttribute('aria-labelledby')) {
    host.setAttribute('role', 'img');
  } else {
    host.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Install the sparkline behavior on the given root.
 *
 * Renders every `.hc-sparkline[data-values]` once, and re-scans subtrees
 * delivered by htmx (`htmx:load`). Repeated calls on the same root return the
 * same uninstaller.
 *
 * @param {Document|Element} [root=document]
 *   The scope to scan. Defaults to the global document when available.
 * @returns {() => void} an idempotent uninstaller (leaves rendered SVGs in
 *   place; removes the htmx:load listener).
 */
export function installSparkline(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const scan = (scope) => {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('.hc-sparkline[data-values]').forEach(render);
  };

  scan(root);

  const target = root.body || root;
  const onLoad = (event) => scan(event && event.target);
  target.addEventListener('htmx:load', onLoad);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    target.removeEventListener('htmx:load', onLoad);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
