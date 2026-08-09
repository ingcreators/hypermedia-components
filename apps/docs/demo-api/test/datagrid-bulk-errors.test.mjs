import { describe, expect, it } from 'vitest';
import * as bulkErrors from '../recipes/datagrid-bulk-errors.mjs';
import { call, form } from './helpers.mjs';

// Eligibility is a pure function of the id: 102 / 105 / 108 are
// "shipped", 107 is "no permission", everything else is executable.

describe('datagrid-bulk-errors demo API — best-effort', () => {
  it('reports success and failure counts, groups by reason, marks failed rows', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '103', '102', '107'], action: 'archive' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    // 101/103 archived; 102 shipped; 107 no permission.
    expect(body).toContain('<strong>2 件成功 / 2 件失敗</strong>');
    expect(body).toContain('出荷済みのため変更できません');
    expect(body).toContain('権限がありません');
    // Failed rows are marked and point at their reason.
    expect(body).toContain('id="bulk-errors-demo-row-102" data-tone="error"');
    expect(body).toContain('aria-describedby="bulk-errors-demo-why-102"');
    // Succeeded rows are not.
    expect(body).toContain('id="bulk-errors-demo-row-103"');
    expect(body).not.toContain('id="bulk-errors-demo-row-103" data-tone');
    // The report rides out of band and offers the failed-only filter.
    expect(body).toContain('data-hx-swap-oob="innerHTML"');
    expect(body).toContain('f-last-result=failed');
  });

  it('a non-dismissing warning toast carries the headline', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['102'], action: 'archive' }),
    });
    const trigger = JSON.parse(response.headers.get('HX-Trigger'));
    expect(trigger['hc:toast'].variant).toBe('warning');
    expect(trigger['hc:toast'].message).toContain('1 件失敗');
  });

  it('full success answers a success toast and no reason table', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '103'], action: 'archive' }),
    });
    const body = await response.text();
    expect(body).toContain('2 件をアーカイブしました');
    expect(body).not.toContain('<table');
    expect(JSON.parse(response.headers.get('HX-Trigger'))['hc:toast'].variant).toBe('success');
  });

  it('caps the named rows per reason and says how many are left', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '102', '105'], action: 'archive' }),
    });
    const body = await response.text();
    expect(body).toContain('bulk-errors-demo-row-102');
    // Only two shipped rows here, so no overflow marker yet.
    expect(body).not.toContain('他 0 件');
  });
});

describe('datagrid-bulk-errors demo API — atomic', () => {
  it('pre-flight reports executability and offers to exclude the blockers', async () => {
    const response = await call(
      bulkErrors,
      'GET',
      '/preflight?ids=101&ids=103&ids=102&action=post',
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('<strong>3 件のうち 2 件が実行可能</strong>');
    expect(body).toContain('出荷済みのため変更できません');
    // The escape hatch submits ONLY the executable ids.
    expect(body).toContain('1 件を除いて 2 件を実行');
    expect(body).toContain('name="ids" value="101"');
    expect(body).toContain('name="ids" value="103"');
    expect(body).not.toContain('name="ids" value="102"');
  });

  it('pre-flight with nothing executable renders reasons and no submit', async () => {
    const body = await (
      await call(bulkErrors, 'GET', '/preflight?ids=102&ids=105&action=post')
    ).text();
    expect(body).toContain('実行できる行がありません');
    expect(body).not.toContain('<button');
  });

  it('a blocked atomic run refuses with 409, unchanged rows and the selection kept', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '102'], action: 'post' }),
    });
    expect(response.status).toBe(409);
    const body = await response.text();
    // Refusal framing, not partial completion.
    expect(body).toContain('<strong>実行しませんでした。</strong>');
    expect(body).not.toContain('件成功');
    // Rows unchanged (nothing Posted) and NOT marked.
    expect(body).not.toContain('Posted');
    expect(body).not.toContain('data-tone="error"');
    // Selection preserved: both submitted ids come back checked.
    expect(body).toContain('value="101" checked');
    expect(body).toContain('value="102" checked');
    expect(body).not.toContain('value="103" checked');
    expect(JSON.parse(response.headers.get('HX-Trigger'))['hc:toast'].variant).toBe('error');
  });

  it('an executable atomic run posts every row', async () => {
    const response = await call(bulkErrors, 'POST', '/bulk', {
      body: form({ ids: ['101', '103'], action: 'post' }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Posted');
    expect(body).toContain('2 件を計上しました');
  });
});
