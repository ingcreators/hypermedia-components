import { test } from '@playwright/test';
import { cssColor, expect } from './helpers/color.mjs';

// Regression: nested data-color wrappers must recolour every
// theme-dependent component primitive (button, checkbox, tabs
// indicator, input focus border). Pre-fix, --hc-button-primary-bg
// resolved its var() chain on :root and was inherited as a frozen
// blue; this spec proves the shadcn-style leaf emission cured it.

// Every axis resolves its action surface from step 600 of its own
// ramp — the ladder puts 600 at L 0.54, which is white-text-safe on
// every hue, so no axis needs a different step or a different
// foreground. The five hues are the accent pentagon (72° apart,
// anchored at blue).
const CASES = [
  { color: 'default', rgb: 'rgb(44, 96, 233)'  },  // blue.600
  { color: 'teal',    rgb: 'rgb(9, 127, 125)' },  // teal.600
  { color: 'lime',    rgb: 'rgb(101, 121, 7)'  },  // lime.600
  { color: 'orange',  rgb: 'rgb(174, 79, 7)'   },  // orange.600
  { color: 'fuchsia', rgb: 'rgb(181, 35, 156)' },  // fuchsia.600
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

  for (const { color, rgb } of CASES) {
    test(`data-color="${color}" → button primary bg`, async ({ page }) => {
      expect(await cssColor(page.getByTestId(`btn-${color}`), 'backgroundColor')).toBeColor(rgb);
    });

    test(`data-color="${color}" → checkbox checked bg`, async ({ page }) => {
      expect(await cssColor(page.getByTestId(`nt-cb-${color}`), 'backgroundColor')).toBeColor(rgb);
    });

    test(`data-color="${color}" → tabs active indicator`, async ({ page }) => {
      // The indicator is rendered as an inset box-shadow whose colour
      // is --hc-tabs-tab-indicator. Verify the resolved var is set
      // correctly on the tab element.
      const tab = page.getByTestId(`tab-${color}`);
      expect(await cssColor(tab, '--hc-tabs-tab-indicator')).toBeColor(rgb);
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
      // gray.700 under dark — not the shipped-light gray.100 / gray.50.
      expect(await cssColor(page.getByTestId('dark-probe'), name)).toBeColor('rgb(55, 65, 81)');
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

  // [var, dark sRGB] — bg is a colour.950 tint, fg is the colour.200 light text.
  const STATUS = [
    ['--hc-badge-info-bg',    'rgb(9, 27, 72)',    'blue.950'],
    ['--hc-badge-info-fg',    'rgb(202, 219, 254)', 'blue.200'],
    ['--hc-alert-success-bg', 'rgb(1, 39, 24)',     'green.950'],
    ['--hc-alert-error-bg',   'rgb(63, 6, 5)',    'red.950'],
    ['--hc-toast-warning-bg', 'rgb(46, 26, 0)',     'amber.950'],
    ['--hc-badge-default-bg', 'rgb(31, 41, 55)',    'gray.800'],
    // Avatar initials flip to the light text colour on the dark fallback.
    ['--hc-avatar-fg',        'rgb(243, 244, 246)', 'gray.100'],
  ];

  for (const [name, rgb, label] of STATUS) {
    test(`${name} is the dark tint (${label})`, async ({ page }) => {
      expect(await cssColor(page.getByTestId('dark-probe'), name)).toBeColor(rgb);
    });
  }
});
