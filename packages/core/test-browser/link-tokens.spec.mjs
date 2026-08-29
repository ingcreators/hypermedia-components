import { test } from '@playwright/test';
import { cssColor, expect } from './helpers/color.mjs';

// Document-level link colours (#569). `hc.base.css` took over the document's
// background and text but stopped short of bare `<a>`, so any anchor outside
// a component fell to the UA's `-webkit-link` blue and `:visited` purple —
// two colours that follow none of data-theme, data-color or data-neutral.
//
// The `:visited` half cannot be a custom property: engines drop var() in a
// visited-dependent declaration, because resolving it would let a page read
// the history bit back out of the cascade. The token build bakes a literal
// per theme instead, which is the one thing a consumer cannot do by hand.

// Light takes 600/700/800 off the accent ramp, dark takes 400/300/200. The
// split is forced, not stylistic: no single step clears 4.5:1 against both
// surfaces (blue.500 is 3.61:1 on light, blue.600 is 3.33:1 on dark).
const CASES = [
  { theme: 'light', color: 'default', link: 'rgb(44, 96, 233)',   hover: 'rgb(31, 76, 199)',   visited: 'rgb(22, 59, 162)' },
  { theme: 'light', color: 'teal',    link: 'rgb(9, 127, 125)',   hover: 'rgb(6, 105, 102)',   visited: 'rgb(4, 83, 81)' },
  { theme: 'light', color: 'lime',    link: 'rgb(101, 121, 7)',   hover: 'rgb(83, 99, 5)',     visited: 'rgb(65, 79, 3)' },
  { theme: 'light', color: 'orange',  link: 'rgb(174, 79, 7)',    hover: 'rgb(144, 64, 4)',    visited: 'rgb(115, 50, 3)' },
  { theme: 'light', color: 'fuchsia', link: 'rgb(181, 35, 156)',  hover: 'rgb(152, 16, 131)',  visited: 'rgb(123, 7, 105)' },
  { theme: 'dark',  color: 'default', link: 'rgb(119, 162, 253)', hover: 'rgb(168, 196, 254)', visited: 'rgb(202, 219, 254)' },
  { theme: 'dark',  color: 'teal',    link: 'rgb(19, 188, 185)',  hover: 'rgb(103, 218, 214)', visited: 'rgb(174, 232, 229)' },
  { theme: 'dark',  color: 'lime',    link: 'rgb(152, 178, 39)',  hover: 'rgb(187, 207, 129)', visited: 'rgb(213, 225, 182)' },
  { theme: 'dark',  color: 'orange',  link: 'rgb(242, 130, 63)',  hover: 'rgb(252, 176, 136)', visited: 'rgb(252, 208, 185)' },
  { theme: 'dark',  color: 'fuchsia', link: 'rgb(225, 122, 201)', hover: 'rgb(240, 170, 221)', visited: 'rgb(245, 205, 234)' },
];

/** Mount one themed wrapper holding a bare anchor. */
async function mount(page, theme, color) {
  await page.goto('/');
  await page.evaluate(([t, c]) => {
    document.querySelector('#link-probe')?.remove();
    const host = document.createElement('div');
    host.id = 'link-probe';
    host.setAttribute('data-theme', t);
    host.setAttribute('data-color', c);
    host.style.background = 'var(--hc-color-bg)';
    host.innerHTML = '<a href="#somewhere" data-testid="bare-link">a bare anchor</a>';
    document.body.append(host);
  }, [theme, color]);
  return page.getByTestId('bare-link');
}

test.describe('document-level link tokens', () => {
  for (const c of CASES) {
    test(`${c.theme}/${c.color} resolves the link token trio`, async ({ page }) => {
      const link = await mount(page, c.theme, c.color);
      await expect(await cssColor(link, '--hc-color-link')).toBeColor(c.link);
      await expect(await cssColor(link, '--hc-color-link-hover')).toBeColor(c.hover);
      await expect(await cssColor(link, '--hc-color-link-visited')).toBeColor(c.visited);
      // The base rule must actually reach the anchor — before #569 this was
      // the UA's -webkit-link blue in every one of these ten combinations.
      await expect(await cssColor(link, 'color')).toBeColor(c.link);
    });
  }

  // The two backgrounds a *document-level* link sits on. `--hc-color-muted-bg`
  // is deliberately not here: it is a component tint (button hover, disabled
  // fields, the datagrid head, skeletons, avatars), and a component owns the
  // foreground on its own surface. The resting step is the only one that
  // would fail there anyway — light `600` scores 4.40:1 and dark `400`
  // scores 3.85:1 against it, worst-accent — and moving the resting link off
  // step `600` would decouple it from `action.primary`, which is what makes
  // a link read as *the accent* rather than an arbitrary blue.
  const SURFACES = ['--hc-color-bg', '--hc-color-surface'];

  for (const surfaceToken of SURFACES) {
    test(`every link colour clears AA on ${surfaceToken}`, async ({ page }) => {
    // The ramp steps were picked from this measurement, so it is the
    // assertion that stops a future re-ladder from quietly dropping a link
    // below 4.5:1 — the failure mode that made the hand-picked literals in
    // consumers rot when 0.2.0 regularised the ramps.
    for (const c of CASES) {
      const link = await mount(page, c.theme, c.color);
      const surface = await cssColor(link, surfaceToken);
      const inks = await Promise.all([
        cssColor(link, '--hc-color-link'),
        cssColor(link, '--hc-color-link-hover'),
        cssColor(link, '--hc-color-link-visited'),
      ]);
      const lum = (rgb) => {
        const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map((n) => {
          const v = Number(n) / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      for (const ink of inks) {
        const [hi, lo] = [lum(ink), lum(surface)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        expect(ratio, `${c.theme}/${c.color} ${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    });
  }

  // A chat bubble is a tinted surface, and an assistant message is prose, so
  // a link genuinely lands there. `--hc-color-muted-bg` (the assistant
  // bubble) is the one surface the document's resting step misses, which is
  // why hc-chat re-pins its own — this is the spec that says so.
  test('links inside a chat bubble clear AA against the bubble', async ({ page }) => {
    for (const { theme, color } of CASES) {
      await page.goto('/chat.html');
      await page.evaluate(([t, c]) => {
        document.documentElement.setAttribute('data-theme', t);
        document.documentElement.setAttribute('data-color', c);
        for (const role of ['assistant', 'user']) {
          const body = document.querySelector(`[data-testid="m-${role}"] .hc-chat__body`);
          body.insertAdjacentHTML('beforeend', ` <a href="#x" data-testid="link-${role}">a link</a>`);
        }
      }, [theme, color]);

      for (const role of ['assistant', 'user']) {
        const link = page.getByTestId(`link-${role}`);
        const ink = await cssColor(link, 'color');
        // The bubble paints the background; read it off the bubble itself,
        // composited over the page for the user bubble's translucent tint.
        const surface = await link.evaluate((el) => {
          const paint = (raw) => {
            const cv = document.createElement('canvas');
            cv.width = cv.height = 1;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
            ctx.fillRect(0, 0, 1, 1);
            ctx.fillStyle = raw;                       // composite the tint over it
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            return `rgb(${r}, ${g}, ${b})`;
          };
          return paint(getComputedStyle(el.closest('.hc-chat__body')).backgroundColor);
        });
        const lum = (rgb) => {
          const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map((n) => {
            const v = Number(n) / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const [hi, lo] = [lum(ink), lum(surface)].sort((a, b) => b - a);
        expect((hi + 0.05) / (lo + 0.05),
          `${theme}/${color} ${role} bubble: ${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('a bubble link keeps its colour when visited', async ({ page }) => {
    // hc.components sits after hc.base, and a layer beats specificity, so
    // `.hc-chat__body a` covers the visited state too — visited is unified
    // with unvisited inside a bubble, deliberately. If a `:visited` rule
    // ever wins here again, the bubble is back to the document's resting
    // colour on its own tinted surface.
    await page.goto('/chat.html');
    const winner = await page.evaluate(() => {
      const body = document.querySelector('[data-testid="m-assistant"] .hc-chat__body');
      body.insertAdjacentHTML('beforeend', ' <a href="#x" id="bubble-link">a link</a>');
      const a = document.getElementById('bubble-link');
      let best = null;
      const walk = (list) => {
        for (const r of list) {
          if (r.selectorText && /\ba:visited\b/.test(r.selectorText)) {
            for (const part of r.selectorText.split(',').map((p) => p.trim())) {
              if (part.includes('a:visited') && a.matches(part.replace(':visited', ''))) {
                best = part;
              }
            }
          }
          if (r.cssRules?.length) walk(r.cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        try { walk(sheet.cssRules); } catch { /* cross-origin */ }
      }
      return { matchedVisited: best, color: getComputedStyle(a).color };
    });
    // A document-level `a:visited` rule still MATCHES the element — it just
    // loses to hc.components. Assert the resting colour is the bubble's,
    // which is what proves the layer order holds.
    const expected = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--hc-color-link-hover').trim());
    const paint = (raw) => page.evaluate((v) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    }, raw);
    await expect(await paint(winner.color)).toBeColor(await paint(expected));
  });

  test('the winning a:visited rule carries that theme’s baked literal', async ({ page }) => {
    // getComputedStyle always reports the UNVISITED colour — that is the
    // privacy guarantee — so the visited colour can only be checked by
    // asking which rule the cascade would pick. Assert the generator's
    // output, not a rendered pixel.
    for (const c of CASES) {
      const link = await mount(page, c.theme, c.color);
      const winner = await link.evaluate((a) => {
        const rules = [];
        const walk = (list) => {
          for (const r of list) {
            // CSSStyleRule exposes an empty .cssRules now that nesting
            // exists, so match on selectorText before recursing.
            if (r.selectorText && /a:(visited|hover)\b/.test(r.selectorText)) {
              for (const part of r.selectorText.split(',').map((p) => p.trim())) {
                rules.push({ part, color: r.style.color });
              }
            }
            if (r.cssRules?.length) walk(r.cssRules);
          }
        };
        for (const sheet of document.styleSheets) {
          try { walk(sheet.cssRules); } catch { /* cross-origin */ }
        }
        const spec = (sel) => [
          (sel.match(/#[\w-]+/g) || []).length,
          (sel.match(/\[[^\]]+\]/g) || []).length + (sel.match(/(?<!:):(?!:)[a-z-]+/g) || []).length,
          (sel.match(/(^|[\s>+~])[a-z]+/g) || []).length,
        ];
        const beats = (x, y) => (x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2]);
        const best = (kind) => {
          let win = null;
          for (const r of rules) {
            if (!r.part.includes(`a:${kind}`)) continue;
            if (!a.matches(r.part.replace(`:${kind}`, ''))) continue;
            const s = spec(r.part);
            if (!win || !beats(win.spec, s)) win = { spec: s, color: r.color, part: r.part };
          }
          return win;
        };
        const visited = best('visited');
        const hover = best('hover');
        return {
          visitedColor: visited?.color ?? null,
          visitedSelector: visited?.part ?? null,
          // A hovered visited link must show the hover colour, so hover has
          // to match visited's specificity and come later.
          hoverWins: Boolean(visited && hover && !beats(visited.spec, hover.spec)),
        };
      });

      expect(winner.visitedSelector, `${c.theme}/${c.color}`).toBeTruthy();
      // The literal is baked, so it never contains var().
      expect(winner.visitedColor).not.toContain('var(');
      const painted = await link.evaluate((el, raw) => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 1;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = raw;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
      }, winner.visitedColor);
      await expect(painted).toBeColor(c.visited);
      expect(winner.hoverWins, `${c.theme}/${c.color} hover must outrank visited`).toBe(true);
    }
  });
});
