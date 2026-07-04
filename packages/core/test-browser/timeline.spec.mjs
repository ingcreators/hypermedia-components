import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// hc-timeline — a pure-CSS vertical activity timeline: a plain <ol> with
// a marker rail, connector segments between markers, and status-colored
// markers via data-variant.
test.beforeEach(async ({ page }) => {
  await page.goto('/timeline.html');
});

const tokenColor = (page, name) =>
  page.evaluate((n) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);

test.describe('hc-timeline', () => {
  test('is a plain list with list semantics intact', async ({ page }) => {
    const list = page.getByTestId('timeline');
    await expect(list).toHaveRole('list');
    await expect(list.locator('.hc-timeline__item')).toHaveCount(3);
    const styles = await list.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { listStyle: cs.listStyleType, padding: cs.paddingInlineStart };
    });
    expect(styles.listStyle).toBe('none');
    expect(styles.padding).toBe('0px');
  });

  test('draws a connector on every item except the last', async ({ page }) => {
    const contents = await page
      .getByTestId('timeline')
      .locator('.hc-timeline__item')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el, '::before').content));
    expect(contents[0]).toBe('""');
    expect(contents[1]).toBe('""');
    expect(contents[2]).toBe('none');
  });

  test('data-variant colours the marker with the status tokens', async ({ page }) => {
    const success = await tokenColor(page, '--hc-timeline-success-bg');
    const warning = await tokenColor(page, '--hc-timeline-warning-bg');
    const neutralBorder = await tokenColor(page, '--hc-timeline-marker-border');

    const bg = (id) =>
      page.getByTestId(id).locator('.hc-timeline__marker').evaluate(
        (el) => ({ bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopColor }),
      );
    expect((await bg('first')).bg).toBe(success);
    expect((await bg('middle')).bg).toBe(warning);
    expect((await bg('last')).border).toBe(neutralBorder);
  });

  test('the marker column leads in LTR and flips under dir=rtl', async ({ page }) => {
    const pos = () =>
      page.getByTestId('first').evaluate((el) => {
        const marker = el.querySelector('.hc-timeline__marker').getBoundingClientRect();
        const content = el.querySelector('.hc-timeline__content').getBoundingClientRect();
        return marker.left < content.left;
      });
    expect(await pos()).toBe(true);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    expect(await pos()).toBe(false);
  });

  test('axe finds no violations in the timeline section', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('#section-timeline').analyze();
    expect(results.violations).toEqual([]);
  });
});
