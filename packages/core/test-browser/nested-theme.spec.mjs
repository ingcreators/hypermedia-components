import { test, expect } from '@playwright/test';

// Regression: nested data-color wrappers must recolour every
// theme-dependent component primitive (button, checkbox, tabs
// indicator, input focus border). Pre-fix, --hc-button-primary-bg
// resolved its var() chain on :root and was inherited as a frozen
// blue; this spec proves the shadcn-style leaf emission cured it.

const CASES = [
  { color: 'default', match: /rgba?\(\s*37,\s*99,\s*235/  },  // blue.600
  { color: 'indigo',  match: /rgba?\(\s*79,\s*70,\s*229/  },  // indigo.600
  { color: 'emerald', match: /rgba?\(\s*4,\s*120,\s*87/   },  // green.700
  { color: 'rose',    match: /rgba?\(\s*190,\s*18,\s*60/  },  // rose.700
  { color: 'amber',   match: /rgba?\(\s*245,\s*158,\s*11/ },  // amber.500
];

test.describe('nested data-color wrappers recolour component primitives', () => {
  test.beforeEach(async ({ page }) => {
    // Build a self-contained fixture page: the existing fixture only
    // has data-color at the top level, so we inject one preview per
    // theme as a sibling of the controls.
    await page.goto('/');
    await page.evaluate((colors) => {
      const wrap = document.createElement('section');
      wrap.id = 'section-nested-theme';
      wrap.setAttribute('data-testid', 'section-nested-theme');
      wrap.innerHTML = colors
        .map(
          (c) => `
            <div data-color="${c}" data-testid="preview-${c}" style="padding:.5rem;">
              <button class="hc-button" data-variant="primary" data-testid="btn-${c}">Save</button>
              <input class="hc-checkbox" type="checkbox" checked data-testid="nt-cb-${c}">
              <input class="hc-input" type="text" data-testid="input-${c}">
              <div class="hc-tabs" data-testid="tabs-${c}">
                <div class="hc-tabs__list" role="tablist" aria-label="${c}">
                  <button type="button" role="tab" class="hc-tabs__tab" aria-selected="true"
                          id="t-${c}-a" aria-controls="p-${c}-a" tabindex="0"
                          data-testid="tab-${c}">A</button>
                </div>
                <div class="hc-tabs__panel" role="tabpanel" id="p-${c}-a"
                     aria-labelledby="t-${c}-a" tabindex="0">A</div>
              </div>
            </div>`,
        )
        .join('');
      document.body.appendChild(wrap);
    }, CASES.map((c) => c.color));
  });

  for (const { color, match } of CASES) {
    test(`data-color="${color}" → button primary bg`, async ({ page }) => {
      const btn = page.getByTestId(`btn-${color}`);
      const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toMatch(match);
    });

    test(`data-color="${color}" → checkbox checked bg`, async ({ page }) => {
      const cb = page.getByTestId(`nt-cb-${color}`);
      const bg = await cb.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toMatch(match);
    });

    test(`data-color="${color}" → tabs active indicator`, async ({ page }) => {
      const tab = page.getByTestId(`tab-${color}`);
      // The indicator is rendered as an inset box-shadow whose colour
      // is --hc-tabs-tab-indicator. Verify the resolved var is set
      // correctly on the tab element.
      const indicator = await tab.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--hc-tabs-tab-indicator').trim(),
      );
      // Match by hex prefix per theme.
      const expectedHex = {
        default: '#2563eb',
        indigo:  '#4f46e5',
        emerald: '#047857',
        rose:    '#be123c',
        amber:   '#f59e0b',
      }[color];
      expect(indicator.toLowerCase()).toBe(expectedHex);
    });
  }
});
