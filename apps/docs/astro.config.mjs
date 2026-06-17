import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import rehypeHcTables from './rehype-hc-tables.mjs';

export default defineConfig({
  site: 'https://ingcreators.com',
  base: '/hypermedia-components',
  // Dogfood: render Markdown reference tables as HC's own hc-table by
  // wrapping each in `.hc-table-scroll.not-content` (see the plugin file).
  markdown: {
    rehypePlugins: [rehypeHcTables],
  },
  integrations: [
    starlight({
      title: 'Hypermedia Components',
      description:
        'Semantic components and recipes for hypermedia applications.',
      // Fail `docs:build` on broken internal links / anchors. Build-time
      // validation over the rendered route graph — no network, no extra
      // CI job; the existing docs job catches the rot. Same-page hash
      // links are excluded: live demo markup uses placeholder
      // href="#" / href="#section" (breadcrumb, pagination, navmenu, …);
      // page paths and cross-page anchors stay validated.
      plugins: [starlightLinksValidator({ exclude: ['#*'] })],
      editLink: {
        baseUrl:
          'https://github.com/ingcreators/hypermedia-components/edit/main/apps/docs/',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/ingcreators/hypermedia-components',
        },
      ],
      sidebar: [
        {
          label: 'Start',
          items: [
            { slug: 'start/introduction' },
            { slug: 'start/installation' },
            { slug: 'start/quick-start' },
            { slug: 'start/philosophy' },
          ],
        },
        { label: 'Fundamentals', items: [{ autogenerate: { directory: 'fundamentals' } }] },
        { label: 'Kitchen sink', slug: 'kitchen-sink' },
        {
          // Grouped by purpose instead of one flat ~50-entry alphabetical
          // list, so the sidebar is scannable. Every component lives under
          // exactly one category; `Overview` links the gallery index.
          label: 'Components',
          items: [
            { label: 'Overview', slug: 'components' },
            {
              label: 'Actions',
              items: [
                'components/button',
                'components/button-group',
                'components/toggle-group',
                'components/toolbar',
                'components/command',
                'components/kbd',
              ],
            },
            {
              label: 'Forms',
              items: [
                'components/field',
                'components/input',
                'components/input-group',
                'components/inputotp',
                'components/select',
                'components/combobox',
                'components/multicombobox',
                'components/checkbox',
                'components/radio',
                'components/switch',
                'components/slider',
                'components/datepicker',
                'components/calendar',
              ],
            },
            {
              label: 'Navigation',
              items: [
                'components/breadcrumb',
                'components/pagination',
                'components/tabs',
                'components/menu',
                'components/menubar',
                'components/navmenu',
                'components/context-menu',
              ],
            },
            {
              label: 'Overlays',
              items: [
                'components/dialog',
                'components/drawer',
                'components/popover',
                'components/hovercard',
                'components/tooltip',
              ],
            },
            {
              label: 'Data display',
              items: [
                'components/table',
                'components/code',
                'components/datagrid',
                'components/card',
                'components/item',
                'components/avatar',
                'components/badge',
                'components/chip',
                'components/separator',
                'components/accordion',
                'components/collapsible',
              ],
            },
            {
              label: 'Feedback',
              items: [
                'components/alert',
                'components/toast',
                'components/progress',
                'components/spinner',
                'components/skeleton',
                'components/empty',
              ],
            },
            {
              label: 'Layout',
              items: [
                'components/aspect',
                'components/scroll-area',
                'components/shell',
                'components/splitter',
                'components/carousel',
              ],
            },
          ],
        },
        { label: 'Blocks', slug: 'blocks' },
        { label: 'Recipes', items: [{ autogenerate: { directory: 'recipes' } }] },
        { label: 'Tokens', items: [{ autogenerate: { directory: 'tokens' } }] },
        { label: 'Integrations', items: [{ autogenerate: { directory: 'integrations' } }] },
        { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
      ],
      customCss: [
        '@hypermedia-components/core/css',
        './src/styles/custom.css',
        './src/styles/preview.css',
      ],
      // Wrap long lines in code blocks instead of a horizontal scrollbar,
      // so the source in each Demo's Code tab stays readable in the narrow
      // card. Mirrors shadcn's wrapped code samples.
      expressiveCode: {
        defaultProps: { wrap: true },
      },
      // Pre-apply the saved Hypermedia Components density and colour
      // theme (if any) before first paint so repeat visitors don't see
      // a flash of the comfortable / default state. Mirrors how
      // Starlight pre-applies its own light/dark theme.
      head: [
        {
          tag: 'script',
          content: `
            (function () {
              try {
                var d = localStorage.getItem('hc-density');
                if (d === 'comfortable' || d === 'compact' || d === 'dense') {
                  document.documentElement.setAttribute('data-density', d);
                }
              } catch (e) {}
              try {
                var c = localStorage.getItem('hc-color');
                if (c === 'default' || c === 'indigo' || c === 'emerald' || c === 'rose' || c === 'amber') {
                  document.documentElement.setAttribute('data-color', c);
                }
              } catch (e) {}
              try {
                var nu = localStorage.getItem('hc-neutral');
                if (nu === 'gray' || nu === 'slate' || nu === 'zinc' || nu === 'neutral' || nu === 'stone') {
                  document.documentElement.setAttribute('data-neutral', nu);
                }
              } catch (e) {}
              try {
                var dir = localStorage.getItem('hc-dir');
                if (dir === 'ltr' || dir === 'rtl') {
                  document.documentElement.setAttribute('dir', dir);
                }
              } catch (e) {}
            })();
          `.trim(),
        },
      ],
      // Override SocialIcons to add density + colour theme pickers
      // next to Starlight's light/dark switcher. Light/dark sync
      // needs no override — both Starlight and HC read the same
      // `data-theme` attribute on <html>.
      components: {
        SocialIcons: './src/components/SocialIcons.astro',
        Head: './src/components/Head.astro',
      },
    }),
  ],
});
