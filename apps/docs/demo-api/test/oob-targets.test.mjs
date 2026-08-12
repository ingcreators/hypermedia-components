import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// An out-of-band swap whose target is missing does NOT fail loudly: htmx
// drops the fragment, the page still renders, and the feature is simply
// invisible. That is how the datagrid-filter demo shipped its
// relative-date control and its applied-conditions bar to nobody.
//
// So the regions a demo page must own are listed here, and checked from
// both ends: the page has them, and the module still targets them.

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(resolve(here, '..', '..', ...parts), 'utf8');

const REGIONS = [
  {
    name: 'datagrid-filter',
    module: 'datagrid-filter.mjs',
    demo: 'DatagridFilterDemo.astro',
    ids: [
      'datagrid-filter-demo-grid',
      'datagrid-filter-demo-fields',
      'datagrid-filter-demo-conditions', // the applied-conditions bar
      'datagrid-filter-demo-due-field', // where relative dates are entered
    ],
  },
  {
    name: 'datagrid-columns',
    module: 'datagrid-columns.mjs',
    demo: 'DatagridColumnsDemo.astro',
    ids: ['datagrid-columns-demo-grid', 'datagrid-columns-demo-fields'],
  },
  {
    name: 'saved-views',
    module: 'saved-views.mjs',
    demo: 'SavedViewsDemo.astro',
    ids: ['saved-views-demo-filters', 'saved-views-demo-views', 'saved-views-demo-results'],
  },
  {
    name: 'datagrid-bulk-errors',
    module: 'datagrid-bulk-errors.mjs',
    demo: 'DatagridBulkErrorsDemo.astro',
    ids: [
      'bulk-errors-demo-rows',
      'bulk-errors-demo-report', // the O(1) summary in the chrome
      'bulk-errors-demo-detail', // the docked, grouped breakdown
    ],
  },
  {
    name: 'row-detail',
    module: 'row-detail.mjs',
    demo: 'RowDetailDemo.astro',
    ids: ['row-detail-demo-list', 'row-detail-demo-record'],
  },
];

describe.each(REGIONS)('$name demo regions', ({ module, demo, ids }) => {
  const api = read('demo-api', 'recipes', module);
  const page = read('src', 'components', 'recipe-demos', demo);

  it('the demo page owns every region the response fills', () => {
    const missing = ids.filter((id) => !page.includes(`"${id}"`));
    expect(missing, 'regions the API answers that the page does not have').toEqual([]);
  });

  it('the module still targets them — the list cannot drift into fiction', () => {
    const stale = ids.filter((id) => !api.includes(id.replace(/^[a-z-]+-demo-/, '')));
    expect(stale, 'regions listed here that the API no longer knows about').toEqual([]);
  });
});
