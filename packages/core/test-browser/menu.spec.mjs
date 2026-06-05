import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('hc-menu', () => {
  test('trigger has ARIA attributes wired automatically', async ({ page }) => {
    const trigger = page.getByTestId('menu-trigger');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveAttribute('aria-controls', 'account-menu');
  });

  test('clicking the trigger opens the popover and aria-expanded flips', async ({ page }) => {
    const trigger = page.getByTestId('menu-trigger');
    const menu = page.getByTestId('menu');

    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('opening focuses the first enabled item', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await expect(page.getByTestId('menu-item-profile')).toBeFocused();
  });

  test('ArrowDown moves focus and skips aria-disabled items', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('menu-item-billing')).toBeFocused();
    // Archived is disabled — ArrowDown lands on Sign out (the last enabled item).
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('menu-item-signout')).toBeFocused();
  });

  test('Home / End jump to first / last enabled items', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await page.keyboard.press('End');
    await expect(page.getByTestId('menu-item-signout')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('menu-item-profile')).toBeFocused();
  });

  test('type-ahead jumps to the first item starting with the typed letter', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    // Profile is the active item — type 'b' should jump to Billing.
    await page.keyboard.press('b');
    await expect(page.getByTestId('menu-item-billing')).toBeFocused();
    // 's' should jump to Sign out (Archived is disabled and skipped).
    await page.keyboard.press('s');
    await expect(page.getByTestId('menu-item-signout')).toBeFocused();
  });

  test('clicking a menuitem dispatches hc:menuselect and closes the menu', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await page.getByTestId('menu-item-billing').click();

    await expect(page.getByTestId('menu')).toBeHidden();
    await expect(page.getByTestId('menu-trigger')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('menu-selected')).toHaveAttribute('data-selected', 'Billing');
  });

  test('Escape closes the menu (popover native behaviour)', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('menu')).toBeHidden();
  });

  test('CSS Anchor Positioning places the menu under the trigger', async ({ page }) => {
    const trigger = page.getByTestId('menu-trigger');
    const menu = page.getByTestId('menu');

    await trigger.click();
    const tBox = await trigger.boundingBox();
    const mBox = await menu.boundingBox();
    expect(tBox).not.toBeNull();
    expect(mBox).not.toBeNull();
    // Menu should sit just below the trigger and roughly aligned to
    // its inline-start edge. Tolerances cover the offset + 1 px CSS
    // border on the trigger.
    expect(mBox.y).toBeGreaterThanOrEqual(tBox.y + tBox.height - 2);
    expect(mBox.y).toBeLessThan(tBox.y + tBox.height + 16);
  });

  test.describe('collision flipping', () => {
    // Mount a fresh menu next to a trigger positioned right at the
    // chosen viewport edge, so the browser must engage one of the
    // `position-try-fallbacks` (flip-block / flip-inline / both).
    async function mountEdgeMenu(page, { id, top, left }) {
      await page.evaluate(({ id, top, left }) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = `position:fixed;top:${top}px;left:${left}px;`;
        wrap.innerHTML = `
          <button class="hc-button" type="button" popovertarget="${id}-menu"
                  id="${id}-trigger" data-testid="${id}-trigger">Open</button>
          <div class="hc-menu" id="${id}-menu" popover role="menu"
               aria-labelledby="${id}-trigger" data-testid="${id}-menu"
               style="min-inline-size:160px;">
            <button class="hc-menu__item" role="menuitem" type="button">Profile</button>
            <button class="hc-menu__item" role="menuitem" type="button">Billing</button>
            <button class="hc-menu__item" role="menuitem" type="button">Team</button>
            <button class="hc-menu__item" role="menuitem" type="button">Sign out</button>
          </div>`;
        document.body.appendChild(wrap);
      }, { id, top, left });
    }

    test('flips block-direction when there is no room below the trigger', async ({ page }) => {
      const vp = page.viewportSize();
      // Place the trigger near the bottom of the viewport so the
      // menu (≥ 150 px tall) cannot fit below.
      await mountEdgeMenu(page, { id: 'bottom-edge', top: vp.height - 60, left: 200 });
      const trigger = page.getByTestId('bottom-edge-trigger');
      const menu = page.getByTestId('bottom-edge-menu');

      await trigger.click();
      const tBox = await trigger.boundingBox();
      const mBox = await menu.boundingBox();
      // Menu top is above the trigger top — the block-axis flipped.
      expect(mBox.y + mBox.height).toBeLessThanOrEqual(tBox.y + 2);
    });

    test('flips inline-direction when there is no room to the inline-end', async ({ page }) => {
      const vp = page.viewportSize();
      // Place the trigger near the right edge so the menu (≥ 160 px
      // wide) cannot fit to the right.
      await mountEdgeMenu(page, { id: 'right-edge', top: 100, left: vp.width - 100 });
      const trigger = page.getByTestId('right-edge-trigger');
      const menu = page.getByTestId('right-edge-menu');

      await trigger.click();
      const tBox = await trigger.boundingBox();
      const mBox = await menu.boundingBox();
      // Menu right edge aligned with trigger right edge (flip-inline);
      // menu's x is far to the left of the trigger's x.
      expect(mBox.x).toBeLessThan(tBox.x);
      // And the whole menu stays inside the viewport.
      expect(mBox.x + mBox.width).toBeLessThanOrEqual(vp.width + 1);
    });
  });

  test.describe('menuitemcheckbox + menuitemradio', () => {
    test('checkbox click toggles aria-checked and keeps the menu open', async ({ page }) => {
      const trigger = page.getByTestId('view-menu-trigger');
      const menu = page.getByTestId('view-menu');
      const sidebar = page.getByTestId('view-sidebar');

      await trigger.click();
      await expect(menu).toBeVisible();
      await expect(sidebar).toHaveAttribute('aria-checked', 'false');

      await sidebar.click();
      await expect(sidebar).toHaveAttribute('aria-checked', 'true');
      await expect(menu).toBeVisible(); // still open
    });

    test('radio click selects this item and clears every sibling in the same group', async ({ page }) => {
      await page.getByTestId('view-menu-trigger').click();
      await page.getByTestId('view-compact').click();

      await expect(page.getByTestId('view-comfortable')).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByTestId('view-compact')).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('view-dense')).toHaveAttribute('aria-checked', 'false');

      // The unrelated checkbox group above is untouched.
      await expect(page.getByTestId('view-toolbar')).toHaveAttribute('aria-checked', 'true');
    });

    test('checked items render the SVG indicator via the ::before pseudo-element', async ({ page }) => {
      await page.getByTestId('view-menu-trigger').click();
      const toolbar = page.getByTestId('view-toolbar');
      // background-image is set on `::before` when aria-checked="true".
      const bg = await toolbar.evaluate((el) =>
        getComputedStyle(el, '::before').backgroundImage,
      );
      expect(bg).toContain('svg');
    });
  });

  test('axe finds no violations in the menu section (open state)', async ({ page }) => {
    await page.getByTestId('menu-trigger').click();
    const results = await new AxeBuilder({ page })
      .include('#section-menu')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test.describe('submenu', () => {
    test('wires the submenu ARIA on the parent item', async ({ page }) => {
      const more = page.getByTestId('sm-more');
      await expect(more).toHaveAttribute('aria-haspopup', 'menu');
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      await expect(more).toHaveAttribute('aria-controls', 'edit-more');
    });

    test('ArrowRight opens the submenu and focuses its first item; ArrowLeft closes it', async ({
      page,
    }) => {
      await page.getByTestId('sm-trigger').click();
      await expect(page.getByTestId('sm-undo')).toBeFocused();

      await page.keyboard.press('ArrowDown'); // → More tools
      await expect(page.getByTestId('sm-more')).toBeFocused();

      await page.keyboard.press('ArrowRight'); // open submenu
      await expect(page.getByTestId('sm-more')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('sm-sub')).toBeVisible();
      await expect(page.getByTestId('sm-inspect')).toBeFocused();

      await page.keyboard.press('ArrowLeft'); // close, focus returns to parent
      await expect(page.getByTestId('sm-sub')).toBeHidden();
      await expect(page.getByTestId('sm-more')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByTestId('sm-more')).toBeFocused();
    });

    test('hovering the parent opens the submenu', async ({ page }) => {
      await page.getByTestId('sm-trigger').click();
      await page.getByTestId('sm-more').hover();
      await expect(page.getByTestId('sm-sub')).toBeVisible();
      await expect(page.getByTestId('sm-more')).toHaveAttribute('aria-expanded', 'true');
    });

    test('the root stays open while the submenu opens, and the parent shows a chevron', async ({
      page,
    }) => {
      await page.getByTestId('sm-trigger').click();
      await page.getByTestId('sm-more').hover();
      await expect(page.getByTestId('sm-menu')).toBeVisible(); // root still open
      // The chevron is painted on the ::after pseudo-element.
      const mask = await page
        .getByTestId('sm-more')
        .evaluate((el) => getComputedStyle(el, '::after').maskImage || getComputedStyle(el, '::after').webkitMaskImage);
      expect(mask).toContain('svg');
    });

    test('selecting a leaf in the submenu closes the whole tree', async ({ page }) => {
      await page.getByTestId('sm-trigger').click();
      await page.getByTestId('sm-more').click(); // open submenu
      await expect(page.getByTestId('sm-inspect')).toBeFocused();

      await page.getByTestId('sm-inspect').click();
      await expect(page.getByTestId('sm-menu')).toBeHidden();
      await expect(page.getByTestId('sm-sub')).toBeHidden();
      await expect(page.getByTestId('sm-selected')).toHaveAttribute('data-selected', 'Inspect');
    });

    test('axe finds no violations with the submenu open', async ({ page }) => {
      await page.getByTestId('sm-trigger').click();
      await page.getByTestId('sm-more').click();
      await expect(page.getByTestId('sm-sub')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include('#section-menu-submenu')
        .analyze();
      expect(results.violations).toEqual([]);
    });
  });
});
