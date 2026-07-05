// installChatScroll — stick-to-bottom for hc-chat transcripts.
//
// A transcript should follow the newest message while the reader is at
// the bottom, and STOP following the moment they scroll up to re-read.
// The kit keeps the DOM in chronological order (no column-reverse — it
// reverses reading order for assistive tech), so following the bottom
// is this behavior's whole job:
//
//   1. On install (and for every hc-chat swapped in later) the list is
//      pinned to the bottom.
//   2. A MutationObserver on the list (childList + characterData, so
//      streamed text chunks count) re-pins after new content — but
//      only while pinned.
//   3. Scrolling more than ~24 px above the bottom releases the pin;
//      scrolling back down re-arms it.
//   4. The pin state is reflected as data-stuck="true|false" on the
//      root — the stylesheet shows .hc-chat__jump only when "false",
//      and a click on it re-pins. Without the behavior the attribute
//      is absent and the jump button stays hidden.
//
// No network, no timers. installChatScroll(root = document) returns an
// uninstaller; repeated calls on the same root return the same
// uninstaller (idempotent). Swapped-in transcripts are picked up via a
// MutationObserver on <body>.

const INSTALL_KEY = '__hcChatScrollUninstall';
const WIRED_KEY = '__hcChatScrollUnwire';
const STICK_THRESHOLD_PX = 24;

function wireChat(chat) {
  if (chat[WIRED_KEY]) return chat[WIRED_KEY];
  const list = chat.querySelector('.hc-chat__list');
  if (!list) return null;

  let stuck = true;

  const atBottom = () =>
    list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_THRESHOLD_PX;

  const reflect = () => {
    chat.setAttribute('data-stuck', stuck ? 'true' : 'false');
  };

  const pin = () => {
    list.scrollTop = list.scrollHeight;
    stuck = true;
    reflect();
  };

  const onScroll = () => {
    stuck = atBottom();
    reflect();
  };

  const onClick = (event) => {
    if (event.target.closest?.('.hc-chat__jump')) pin();
  };

  const observer = new MutationObserver(() => {
    if (stuck) pin();
  });
  observer.observe(list, { childList: true, subtree: true, characterData: true });
  list.addEventListener('scroll', onScroll, { passive: true });
  chat.addEventListener('click', onClick);
  pin();

  const unwire = () => {
    observer.disconnect();
    list.removeEventListener('scroll', onScroll);
    chat.removeEventListener('click', onClick);
    chat.removeAttribute('data-stuck');
    delete chat[WIRED_KEY];
  };
  chat[WIRED_KEY] = unwire;
  return unwire;
}

/**
 * Keep every `.hc-chat` transcript pinned to its newest message while
 * the reader is at the bottom; release on scroll-up, re-pin via the
 * `.hc-chat__jump` button. Reflects `data-stuck` for the stylesheet.
 *
 * @param {Document} [root=document]
 * @returns {() => void} idempotent uninstaller
 */
export function installChatScroll(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const unwires = new Set();

  const wireAll = (scope) => {
    if (scope.matches?.('.hc-chat')) {
      const u = wireChat(scope);
      if (u) unwires.add(u);
    }
    for (const chat of scope.querySelectorAll?.('.hc-chat') ?? []) {
      const u = wireChat(chat);
      if (u) unwires.add(u);
    }
  };

  wireAll(root.body ?? root);

  // Pick up transcripts swapped in later (htmx et al).
  const swapObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) wireAll(node);
      }
    }
  });
  swapObserver.observe(root.body ?? root, { childList: true, subtree: true });

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    swapObserver.disconnect();
    for (const unwire of unwires) unwire();
    unwires.clear();
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
