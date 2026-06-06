// installDrawer — behavior for hc-drawer.
//
// The native <dialog> already handles focus trapping, Escape-to-close, and
// the ::backdrop layer. This behavior adds the two pieces the platform does
// not:
//
//   - Backdrop click → close. A `click` whose target is the dialog itself
//     (landed on the backdrop, not the content box) calls `dialog.close()`.
//
//   - Drag to dismiss. Drag the panel toward its anchored edge (the axis
//     follows `data-side`: right/left → horizontal, top/bottom → vertical);
//     past ~40% of the panel size, or with a quick flick, it slides out and
//     closes — release short of that and it snaps back. The drag is grabbed
//     from the panel chrome (header / footer), never the scrollable body or
//     an interactive control, and only the outward direction moves (inward is
//     clamped — no rubber-banding, so reduced-motion needs no special case).
//
// installDrawer(root = document) returns an uninstaller. Repeated calls on
// the same root return the same uninstaller.

const INSTALL_KEY = '__hcDrawerUninstall';

// Per `data-side`: drag axis, the outward (dismiss) direction sign, and the
// off-screen translate used for the fly-out.
const SIDES = {
  right: { axis: 'x', sign: 1, off: '100% 0' },
  left: { axis: 'x', sign: -1, off: '-100% 0' },
  top: { axis: 'y', sign: -1, off: '0 -100%' },
  bottom: { axis: 'y', sign: 1, off: '0 100%' },
};

function sideOf(dialog) {
  return SIDES[dialog.getAttribute('data-side')] || SIDES.right;
}

/**
 * Whether a drag should dismiss the drawer: it travelled past `threshold` of
 * the panel size in the dismiss direction, or was released with at least
 * `flick` outward velocity (px/ms). Pure — exported for unit tests.
 *
 * @param {{delta:number,size:number,velocity:number,threshold?:number,flick?:number}} o
 * @returns {boolean}
 */
export function dragShouldDismiss({ delta, size, velocity, threshold = 0.4, flick = 0.5 }) {
  return delta > size * threshold || velocity > flick;
}

function attach(dialog, detachers) {
  if (detachers.has(dialog)) return;

  // A drag captures the pointer on the dialog, which makes the synthesized
  // click after a drag target the dialog too — suppress that one so it isn't
  // mistaken for a backdrop click.
  let suppressClick = false;

  function onClick(event) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    // The native <dialog> reports backdrop clicks with the dialog itself as
    // `event.target`. Clicks on content land on the content element.
    if (event.target === dialog) dialog.close();
  }

  // ---- Drag to dismiss ----
  let side = SIDES.right;
  let startPos = 0;
  let lastPos = 0;
  let lastT = 0;
  let delta = 0;
  let size = 1;
  let velocity = 0;
  let dragging = false;

  // The drag is grabbed from the chrome, not the scrollable body or controls.
  function isGrabbable(target) {
    return !target.closest?.(
      '.hc-drawer__body, button, a[href], input, select, textarea, [contenteditable="true"]',
    );
  }

  function onPointerdown(event) {
    if (event.button != null && event.button !== 0) return; // primary only
    // A press on the dialog itself is the backdrop — let onClick close it.
    if (event.target === dialog) return;
    if (!dialog.open || !isGrabbable(event.target)) return;
    side = sideOf(dialog);
    const horizontal = side.axis === 'x';
    size = (horizontal ? dialog.offsetWidth : dialog.offsetHeight) || 1;
    startPos = horizontal ? event.clientX : event.clientY;
    lastPos = startPos;
    lastT = event.timeStamp;
    velocity = 0;
    delta = 0;
    dragging = true;
    dialog.style.transition = 'none';
    dialog.setPointerCapture?.(event.pointerId);
  }

  function onPointermove(event) {
    if (!dragging) return;
    const horizontal = side.axis === 'x';
    const pos = horizontal ? event.clientX : event.clientY;
    // Outward component only; inward (negative) is clamped to 0 — no rubber-band.
    delta = Math.max(0, (pos - startPos) * side.sign);
    // Sample velocity over a real time window (≥ 8 ms) so a burst of
    // near-instant events can't fake a flick.
    const dt = event.timeStamp - lastT;
    if (dt >= 8) {
      velocity = ((pos - lastPos) * side.sign) / dt;
      lastPos = pos;
      lastT = event.timeStamp;
    }
    const shift = side.sign * delta;
    dialog.style.translate = horizontal ? `${shift}px 0` : `0 ${shift}px`;
  }

  function settle(dismiss) {
    dragging = false;
    dialog.style.transition = ''; // restore the CSS slide transition
    if (dismiss) {
      dialog.style.translate = side.off; // fly out to off-screen, then close
      const done = () => {
        dialog.style.transition = '';
        dialog.style.translate = '';
        if (dialog.open) dialog.close();
      };
      dialog.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 360); // fallback (reduced-motion / no transitionend)
    } else {
      dialog.style.translate = ''; // snap back to the open position
    }
  }

  function onPointerup(event) {
    if (!dragging) return;
    dialog.releasePointerCapture?.(event.pointerId);
    suppressClick = true; // the trailing click belongs to this drag, not the backdrop
    settle(dragShouldDismiss({ delta, size, velocity }));
  }

  dialog.addEventListener('click', onClick);
  dialog.addEventListener('pointerdown', onPointerdown);
  dialog.addEventListener('pointermove', onPointermove);
  dialog.addEventListener('pointerup', onPointerup);
  dialog.addEventListener('pointercancel', onPointerup);

  detachers.set(dialog, () => {
    dialog.removeEventListener('click', onClick);
    dialog.removeEventListener('pointerdown', onPointerdown);
    dialog.removeEventListener('pointermove', onPointermove);
    dialog.removeEventListener('pointerup', onPointerup);
    dialog.removeEventListener('pointercancel', onPointerup);
  });
}

/**
 * Install the drawer behavior on every `.hc-drawer` in the document.
 * Adds backdrop-click-to-close to the native `<dialog>` element;
 * everything else (focus trap, Escape, the ::backdrop layer) is
 * already provided by the platform.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installDrawer(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-drawer')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-drawer')) attach(node, detachers);
          node.querySelectorAll?.('.hc-drawer').forEach((el) =>
            attach(el, detachers),
          );
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
