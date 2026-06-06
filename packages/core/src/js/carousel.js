// installCarousel — a scroll-snap carousel whose source of truth is the
// native scroll position.
//
//   <div class="hc-carousel" aria-label="Featured">
//     <div class="hc-carousel__viewport">
//       <div class="hc-carousel__slide">…</div>
//       <div class="hc-carousel__slide">…</div>
//     </div>
//     <button data-hc-carousel-prev aria-label="Previous">‹</button>
//     <button data-hc-carousel-next aria-label="Next">›</button>
//     <div class="hc-carousel__dots" data-hc-carousel-dots
//          role="group" aria-label="Choose slide"></div>
//   </div>
//
// The CSS scroll-snap rail does the motion; this behavior only:
//   - tracks the in-view slide with an IntersectionObserver (data-active),
//   - syncs optional dot controls (auto-generated if the container is empty)
//     and prev/next enabled state,
//   - scrolls on prev/next/dot click and ←/→ on the focused rail (native
//     smooth scroll — no JS transform / animation engine),
//   - optionally autoplays (data-autoplay="<ms>"), opt-in only, pausing on
//     hover / focus and disabled under prefers-reduced-motion.
//
// No network — slides are plain HTML (htmx can lazy-load them as partials).
// installCarousel(root = document) returns an idempotent uninstaller.

const INSTALL_KEY = '__hcCarouselUninstall';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function attach(carousel, detachers) {
  if (detachers.has(carousel)) return;
  const viewport = carousel.querySelector('.hc-carousel__viewport');
  if (!viewport) return;
  const slides = Array.from(viewport.querySelectorAll(':scope > .hc-carousel__slide'));
  if (slides.length === 0) return;

  const doc = carousel.ownerDocument || document;
  const prevBtn = carousel.querySelector('[data-hc-carousel-prev]');
  const nextBtn = carousel.querySelector('[data-hc-carousel-next]');
  const dotsContainer = carousel.querySelector('[data-hc-carousel-dots]');
  const cleanups = [];

  let activeIndex = 0;

  // Slide ARIA scaffolding.
  slides.forEach((slide, i) => {
    if (!slide.hasAttribute('role')) slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    if (!slide.hasAttribute('aria-label')) {
      slide.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
    }
  });

  // The rail is the focusable, keyboard-driven region.
  if (!viewport.hasAttribute('tabindex')) viewport.setAttribute('tabindex', '0');
  if (!viewport.hasAttribute('role')) viewport.setAttribute('role', 'group');
  viewport.setAttribute('aria-roledescription', 'carousel');
  if (!viewport.hasAttribute('aria-label') && !viewport.hasAttribute('aria-labelledby')) {
    viewport.setAttribute('aria-label', carousel.getAttribute('aria-label') || 'Carousel');
  }

  // Dots: reuse author-provided [data-hc-carousel-dot]s, else generate one
  // per slide into the container.
  let dots = [];
  if (dotsContainer) {
    const existing = dotsContainer.querySelectorAll('[data-hc-carousel-dot]');
    if (existing.length) {
      dots = Array.from(existing);
    } else {
      dots = slides.map((_, i) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'hc-carousel__dot';
        b.setAttribute('data-hc-carousel-dot', '');
        b.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dotsContainer.appendChild(b);
        return b;
      });
    }
  }

  function scrollToIndex(i) {
    const idx = Math.max(0, Math.min(slides.length - 1, i));
    const slide = slides[idx];
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    if (typeof slide.scrollIntoView === 'function') {
      slide.scrollIntoView({ behavior, inline: 'start', block: 'nearest' });
    } else {
      viewport.scrollLeft = slide.offsetLeft - viewport.offsetLeft;
    }
  }

  function setActive(i) {
    activeIndex = i;
    slides.forEach((s, idx) => s.toggleAttribute('data-active', idx === i));
    dots.forEach((d, idx) => {
      if (idx === i) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
    if (prevBtn) prevBtn.disabled = i <= 0;
    if (nextBtn) nextBtn.disabled = i >= slides.length - 1;
    carousel.dispatchEvent(
      new CustomEvent('hc:carouselchange', { bubbles: true, detail: { index: i } }),
    );
  }

  setActive(0);

  // Track the most-visible slide.
  let observer = null;
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        let best = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (best) {
          const idx = slides.indexOf(best.target);
          if (idx !== -1 && idx !== activeIndex) setActive(idx);
        }
      },
      { root: viewport, threshold: 0.6 },
    );
    slides.forEach((s) => observer.observe(s));
  }

  // Controls.
  const onPrev = () => scrollToIndex(activeIndex - 1);
  const onNext = () => scrollToIndex(activeIndex + 1);
  if (prevBtn) {
    prevBtn.addEventListener('click', onPrev);
    cleanups.push(() => prevBtn.removeEventListener('click', onPrev));
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', onNext);
    cleanups.push(() => nextBtn.removeEventListener('click', onNext));
  }
  dots.forEach((d, i) => {
    const onDot = () => scrollToIndex(i);
    d.addEventListener('click', onDot);
    cleanups.push(() => d.removeEventListener('click', onDot));
  });

  const onKey = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollToIndex(activeIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollToIndex(activeIndex - 1);
    }
  };
  viewport.addEventListener('keydown', onKey);
  cleanups.push(() => viewport.removeEventListener('keydown', onKey));

  // Autoplay — opt-in, motion-safe, pauses on hover / focus.
  const autoplayMs = parseInt(carousel.getAttribute('data-autoplay'), 10);
  const autoplayOn = Number.isFinite(autoplayMs) && autoplayMs > 0 && !prefersReducedMotion();
  if (autoplayOn) {
    let timer = null;
    const tick = () => scrollToIndex(activeIndex >= slides.length - 1 ? 0 : activeIndex + 1);
    const start = () => {
      if (timer == null) timer = setInterval(tick, autoplayMs);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    start();
    carousel.addEventListener('pointerenter', stop);
    carousel.addEventListener('pointerleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', start);
    cleanups.push(() => {
      stop();
      carousel.removeEventListener('pointerenter', stop);
      carousel.removeEventListener('pointerleave', start);
      carousel.removeEventListener('focusin', stop);
      carousel.removeEventListener('focusout', start);
    });
  }

  detachers.set(carousel, () => {
    if (observer) observer.disconnect();
    for (const c of cleanups) c();
  });
}

/**
 * Install the carousel behavior on every `.hc-carousel` in the document.
 *
 * @param {Document|Element} [root]
 * @returns {() => void}
 */
export function installCarousel(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  const detachers = new Map();
  for (const el of root.querySelectorAll('.hc-carousel')) attach(el, detachers);

  let observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.hc-carousel')) attach(node, detachers);
          node.querySelectorAll?.('.hc-carousel').forEach((el) => attach(el, detachers));
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
