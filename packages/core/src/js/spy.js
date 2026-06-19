// installSpy — scrollspy for the hc-toc "On this page" navigation (#271).
//
//   <nav class="hc-toc" data-hc-spy aria-label="On this page">
//     <a class="hc-toc__link" href="#sec-inputs">Inputs</a>
//     <a class="hc-toc__link" href="#sec-sql">SQL</a>
//   </nav>
//   …
//   <section id="sec-inputs">…</section>
//   <section id="sec-sql">…</section>
//
// For each `[data-hc-spy]` nav the behavior resolves every in-page anchor
// (`a[href^="#"]`) to its target element and observes those targets with a
// single IntersectionObserver. The link of the section currently at the top
// of the viewport gets `aria-current="location"` plus a `data-active` hook
// for CSS; the previous one is cleared.
//
// Selection is the standard scrollspy trick, not "largest intersection
// ratio" (which lets a tall section beat a short one). The observer's root
// is shrunk to a band at the TOP of the viewport (`TOP_BAND` below) so a
// section crossing near the top fires a callback; selection itself reads
// live geometry: the active section is the LAST one (document order) whose
// top edge has reached the activation line (the band's bottom). That keeps
// the right link active even when the previous section is only edge-
// touching the line (browsers report a zero-area intersection as
// "intersecting", so an intersection-set + document-order pick would wrongly
// favour the earlier section). Before the first heading reaches the line the
// first link stays active; past the last heading the last link stays active —
// the TOC never blanks out. `TOP_BAND` is the single tuning knob.
//
// No smooth scroll is forced — clicking a link is the browser's native
// anchor jump, so there is nothing for `prefers-reduced-motion` to gate.
// Without JS (or IntersectionObserver) the nav is still a working list of
// anchor links; only the active highlight is missing — progressive
// enhancement.
//
// installSpy(root = document) returns an idempotent uninstaller. Repeated
// calls on the same root return the same uninstaller.

const INSTALL_KEY = '__hcSpyUninstall';
const SELECTOR = '[data-hc-spy]';

// The activation line sits this fraction of the viewport down from the top.
// The observer's root is shrunk to the band above it so a section crossing
// the line fires a callback; selection reads the line directly.
const TOP_BAND = 0.3;
const ROOT_MARGIN = `0px 0px -${(1 - TOP_BAND) * 100}% 0px`;

function attach(nav, detachers) {
  if (detachers.has(nav)) return;
  if (typeof IntersectionObserver === 'undefined') return; // no-op; links still work

  const doc = nav.ownerDocument || document;

  // Resolve each in-page link to an existing section, in document order.
  const sections = [];
  const linkFor = new Map();
  for (const link of nav.querySelectorAll('a[href^="#"]')) {
    const id = decodeURIComponent((link.hash || '').slice(1));
    if (!id) continue;
    const section = doc.getElementById(id);
    if (!section) continue; // only track sections that exist
    if (!linkFor.has(section)) {
      sections.push(section);
      linkFor.set(section, link);
    }
  }
  if (sections.length === 0) return;

  let current = null;

  function setActive(section) {
    const link = section ? linkFor.get(section) : null;
    if (link === current) return;
    if (current) {
      current.removeAttribute('aria-current');
      current.removeAttribute('data-active');
    }
    if (link) {
      link.setAttribute('aria-current', 'location');
      link.setAttribute('data-active', '');
    }
    current = link;
  }

  function update() {
    const view = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    const line = (view?.innerHeight || 0) * TOP_BAND;
    // The last section whose top has reached the activation line. Default to
    // the first section (before any heading reaches the line).
    let active = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) active = section;
      else break;
    }
    setActive(active);
  }

  const observer = new IntersectionObserver(update, { rootMargin: ROOT_MARGIN, threshold: 0 });
  for (const section of sections) observer.observe(section);

  detachers.set(nav, () => {
    observer.disconnect();
    setActive(null);
  });
}

/**
 * Install scrollspy on every `[data-hc-spy]` navigation in the document.
 * Marks the link of the section currently in view with
 * `aria-current="location"` (and a `data-active` CSS hook). Navs added
 * later (htmx swaps) are wired automatically via a MutationObserver.
 *
 * @param {Document|Element} [root]
 * @returns {() => void} an idempotent uninstaller.
 */
export function installSpy(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const nav of root.querySelectorAll(SELECTOR)) attach(nav, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.(SELECTOR)) attach(node, detachers);
          node.querySelectorAll?.(SELECTOR).forEach((el) => attach(el, detachers));
        }
      }
    });
    observer.observe(root.body ?? root, { childList: true, subtree: true });
  }

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    if (observer) observer.disconnect();
    for (const detach of detachers.values()) detach();
    detachers.clear();
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
