import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/lazy-tree.mjs';
import { call } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/lazy-tree';

describe('lazy-tree demo API', () => {
  it('returns the children of reports: two lazy branches and a leaf', async () => {
    const response = await call(mod, 'GET', '/nodes/reports/children');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body.match(/<li class="hc-tree__item"/g)).toHaveLength(3);

    // Lazy branch shape: the contract's four htmx attributes + empty group.
    expect(body).toContain(
      `<li class="hc-tree__item" aria-expanded="false" data-hx-get="${API}/nodes/q1/children" data-hx-target="find .hc-tree__group" data-hx-swap="innerHTML" data-hx-trigger="hc:treeexpand once">`,
    );
    expect(body).toContain(`data-hx-get="${API}/nodes/q2/children"`);
    expect(body).toContain('<span class="hc-tree__toggle" aria-hidden="true"></span>');
    expect(body).toContain('<ul class="hc-tree__group"></ul>');

    // Leaf shape: label only — no link, no branch attributes.
    expect(body).toContain(
      '<li class="hc-tree__item"><span class="hc-tree__row"><span class="hc-tree__label">annual-2025.pdf</span></span></li>',
    );
    expect(body).not.toContain('<a ');
    expect(body).not.toContain('<!doctype');
  });

  it('serves the nested archive branch recursively (q2 → archive → leaves)', async () => {
    const q2 = await (await call(mod, 'GET', '/nodes/q2/children')).text();
    expect(q2).toContain(`data-hx-get="${API}/nodes/archive/children"`);
    expect(q2).toContain('<span class="hc-tree__label">2026-04.pdf</span>');

    const archive = await (await call(mod, 'GET', '/nodes/archive/children')).text();
    expect(archive.match(/<li class="hc-tree__item"/g)).toHaveLength(2);
    expect(archive).toContain('q2-2019.pdf');
    expect(archive).toContain('q2-2020.pdf');
    expect(archive).not.toContain('aria-expanded');
  });

  it('answers an unknown node id with a single "Nothing here." leaf', async () => {
    const response = await call(mod, 'GET', '/nodes/does-not-exist/children');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe(
      '<li class="hc-tree__item"><span class="hc-tree__row"><span class="hc-tree__label">Nothing here.</span></span></li>',
    );
  });

  it('answers restricted with an empty 200 and an error toast header', async () => {
    const response = await call(mod, 'GET', '/nodes/restricted/children');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    const trigger = response.headers.get('HX-Trigger');
    expect(trigger).toContain('hc:toast');
    expect(trigger).toContain('You do not have access to this folder');
    expect(trigger).toContain('"variant":"error"');
    expect(trigger).toMatch(/^[\x00-\x7f]*$/);
  });

  it('returns null for unknown routes', () => {
    expect(call(mod, 'GET', '/nodes/reports')).toBeNull();
    expect(call(mod, 'POST', '/nodes/reports/children')).toBeNull();
    expect(call(mod, 'GET', '/children')).toBeNull();
  });
});
