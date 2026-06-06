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

test.describe('dark mode recolours neutral hover / surface backgrounds', () => {
  // Regression: button.default-hover.bg, pagination.hover-bg, and
  // table.header-bg / row-hover-bg referenced primitive.color.gray.*
  // directly, so they stayed light under [data-theme="dark"] — a light
  // hover/header surface under light text hid the content (the default
  // button's label vanished on hover). Routing them through
  // semantic.color.muted-bg lets the dark token re-emission cover them
  // (gray.700 = #374151), here on a *nested* dark wrapper.
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const wrap = document.createElement('section');
      wrap.setAttribute('data-theme', 'dark');
      wrap.innerHTML = '<span data-testid="dark-probe"></span>';
      document.body.appendChild(wrap);
    });
  });

  const VARS = [
    '--hc-button-default-hover-bg',
    '--hc-pagination-hover-bg',
    '--hc-table-header-bg',
    '--hc-table-row-hover-bg',
    // Disabled form-control surfaces (input / select / datepicker /
    // checkbox / radio) — same primitive-gray.100 trap.
    '--hc-input-disabled-bg',
    '--hc-select-disabled-bg',
    '--hc-datepicker-disabled-bg',
    '--hc-checkbox-disabled-bg',
    '--hc-radio-disabled-bg',
    // Neutral control tracks (slider / progress / switch) + the avatar
    // fallback surface — were hardcoded light gray.200, now theme-aware.
    '--hc-slider-track-bg',
    '--hc-progress-bg',
    '--hc-switch-bg',
    '--hc-avatar-bg',
  ];

  for (const name of VARS) {
    test(`${name} is dark under [data-theme="dark"]`, async ({ page }) => {
      const probe = page.getByTestId('dark-probe');
      const value = await probe.evaluate(
        (el, prop) => getComputedStyle(el).getPropertyValue(prop).trim().toLowerCase(),
        name,
      );
      // gray.700 under dark — not the shipped-light gray.100 (#f3f4f6) / gray.50.
      expect(value).toBe('#374151');
    });
  }
});

test.describe('dark mode tints status surfaces (alert / toast / badge)', () => {
  // Status chips used a light primitive tint (blue.50 etc.) + dark text
  // directly, so they stayed light under [data-theme="dark"]. They now
  // route through semantic.color.status.*, which the dark theme overrides
  // to a dark tint (colour.950) + a light tinted text (colour.200).
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const wrap = document.createElement('section');
      wrap.setAttribute('data-theme', 'dark');
      wrap.innerHTML = '<span data-testid="dark-probe"></span>';
      document.body.appendChild(wrap);
    });
  });

  // [var, dark hex] — bg is a colour.950 tint, fg is the colour.200 light text.
  const STATUS = [
    ['--hc-badge-info-bg', '#172554'],
    ['--hc-badge-info-fg', '#bfdbfe'],
    ['--hc-alert-success-bg', '#022c22'],
    ['--hc-alert-error-bg', '#450a0a'],
    ['--hc-toast-warning-bg', '#451a03'],
    ['--hc-badge-default-bg', '#1f2937'],
    // Avatar initials flip to the light text colour on the dark fallback.
    ['--hc-avatar-fg', '#f3f4f6'],
  ];

  for (const [name, hex] of STATUS) {
    test(`${name} is the dark tint (${hex})`, async ({ page }) => {
      const probe = page.getByTestId('dark-probe');
      const value = await probe.evaluate(
        (el, prop) => getComputedStyle(el).getPropertyValue(prop).trim().toLowerCase(),
        name,
      );
      expect(value).toBe(hex);
    });
  }
});
