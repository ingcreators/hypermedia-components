// installAvatar — image load/error → initials fallback for hc-avatar.
//
// Drives the `data-state` of a composite avatar off the native image
// `load` / `error` events — no network of its own:
//
//   <span class="hc-avatar" role="img" aria-label="Ada Lovelace">
//     <img class="hc-avatar__image" src="/ada.jpg" alt="">
//     <span class="hc-avatar__fallback" aria-hidden="true">AL</span>
//   </span>
//
// State machine (written to `data-state` on the wrapper):
//
//   loading  — image is fetching; the fallback shows so the slot is never
//              empty (this is the default while waiting).
//   pending  — image is fetching but `data-delay="<ms>"` is set, so the
//              fallback stays hidden for that window to avoid a flash on a
//              fast connection. Becomes `loading` when the delay elapses.
//   loaded   — image decoded successfully; the fallback is hidden.
//   error    — the image failed or has no `src`; the fallback shows and the
//              broken image is removed from the box.
//
// Each change dispatches a bubbling `hc:avatarstatechange` (detail.state).
//
// Only composite avatars (a `.hc-avatar` with a `.hc-avatar__image` child)
// are managed; plain `<img class="hc-avatar">` / `<span class="hc-avatar">`
// avatars are left untouched. Progressive: with JS off the image still
// covers the fallback when it loads (a broken image shows the fallback
// behind it).
//
// installAvatar(root = document) returns an idempotent uninstaller.

const INSTALL_KEY = '__hcAvatarUninstall';

function imageOf(avatar) {
  return avatar.querySelector(':scope > .hc-avatar__image');
}

function hasSrc(img) {
  const src = img.getAttribute('src');
  return src != null && src.trim() !== '';
}

// Synchronous verdict for an image that may already be settled (e.g. served
// from cache before the behavior runs). null means "still loading".
function settle(img) {
  if (!hasSrc(img)) return 'error';
  if (img.complete) return img.naturalWidth > 0 ? 'loaded' : 'error';
  return null;
}

function setState(avatar, state) {
  if (avatar.dataset.state === state) return;
  avatar.dataset.state = state;
  avatar.dispatchEvent(
    new CustomEvent('hc:avatarstatechange', { bubbles: true, detail: { state } }),
  );
}

function attach(avatar, detachers) {
  if (detachers.has(avatar)) return;
  const img = imageOf(avatar);
  if (!img) return; // a plain avatar — nothing to manage

  let timer = null;
  const clearTimer = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  function onLoad() {
    clearTimer();
    setState(avatar, 'loaded');
  }
  function onError() {
    clearTimer();
    setState(avatar, 'error');
  }

  const initial = settle(img);
  if (initial === 'loaded' || initial === 'error') {
    setState(avatar, initial);
  } else {
    const delay = Math.max(0, parseInt(avatar.getAttribute('data-delay'), 10) || 0);
    if (delay > 0) {
      setState(avatar, 'pending');
      timer = setTimeout(() => {
        timer = null;
        if (avatar.dataset.state === 'pending') setState(avatar, 'loading');
      }, delay);
    } else {
      setState(avatar, 'loading');
    }
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
  }

  detachers.set(avatar, () => {
    clearTimer();
    img.removeEventListener('load', onLoad);
    img.removeEventListener('error', onError);
  });
}

/**
 * Install the avatar behavior on every composite `.hc-avatar` (one holding a
 * `.hc-avatar__image`) in the document: track the image's load / error state
 * in `data-state` so the initials fallback shows when the image is missing.
 * The CSS works without it; this adds the automatic swap.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installAvatar(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();

  for (const el of root.querySelectorAll('.hc-avatar')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-avatar')) attach(node, detachers);
          node.querySelectorAll?.('.hc-avatar').forEach((el) => attach(el, detachers));
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
