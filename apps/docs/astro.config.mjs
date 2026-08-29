import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';
import rehypeHcTables from './rehype-hc-tables.mjs';
import { demoApiDevPlugin } from './demo-api/vite-plugin.mjs';

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
      // English stays at the root URLs (zero churn for existing links
      // and the Lighthouse probes); Japanese lives under /ja/.
      // Untranslated pages are served under /ja/** via Starlight's
      // built-in fallback (English content + a localized notice), so
      // every route exists in both locales.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        ja: { label: '日本語', lang: 'ja' },
      },
      // Fail `docs:build` on broken internal links / anchors. Build-time
      // validation over the rendered route graph — no network, no extra
      // CI job; the existing docs job catches the rot. Same-page hash
      // links are excluded: live demo markup uses placeholder
      // href="#" / href="#section" (breadcrumb, pagination, navmenu, …);
      // page paths and cross-page anchors stay validated.
      // errorOnFallbackPages: false — ja pages may link to /ja/ routes
      // whose content is still the English fallback; every route exists
      // in both locales, so those links resolve. Translated pages that
      // arrive later simply take the fallback's place.
      plugins: [
        // The full-size template preview is a plain Astro route
        // (src/pages/), not a Starlight content page, so the validator
        // cannot see it — it is checked by the docs build itself, which
        // fails if the route stops emitting.
        starlightLinksValidator({
          exclude: ['#*', '/hypermedia-components/templates/data-grid-page-preview/'],
          errorOnFallbackPages: false,
        }),
        // /llms.txt, /llms-full.txt, /llms-small.txt for AI coding
        // agents. The markup IS the wire contract here, so a model
        // holding these files can emit working HC + htmx fragments
        // without scraping the site. Only the default (English) locale
        // is emitted; /ja/ mirrors the same content for humans.
        starlightLlmsTxt({
          projectName: 'Hypermedia Components',
          description:
            'Semantic CSS components, small vanilla-JS behaviors, and htmx recipes for hypermedia (HTML-over-the-wire) applications — the markup is the wire contract.',
          details: [
            'Facts an agent should hold when generating code with this kit:',
            '',
            '- Class prefix `hc-`; theming via `--hc-*` custom properties; variants via `data-variant` / `data-size`, never utility classes.',
            '- htmx attributes are written in the `data-hx-*` form (not `hx-*`).',
            '- Light DOM only. State lives in HTML attributes (`aria-*`, `data-*`, native disabled/invalid).',
            '- Behaviors auto-install from `hc.behaviors.js` and never own network requests — htmx does.',
            '- Runtime axes on `<html>`: `data-theme`, `data-color`, `data-neutral`, `data-density`, `dir`.',
            '- Every recipe documents its server response contract; `npx @hypermedia-components/cli add <recipe>` copies the scaffold and `hc validate` machine-checks it.',
          ].join('\n'),
          // The two demo galleries are huge and pure markup showcase —
          // keep the trimmed set focused on contracts and guides.
          exclude: ['kitchen-sink', 'blocks'],
          promote: ['index*', 'start/**', 'fundamentals/**'],
          // Structured counterparts to this prose: agents that prefer
          // JSON can enumerate the kit instead of parsing pages.
          optionalLinks: [
            {
              label: 'Kit manifest (JSON)',
              url: 'https://ingcreators.com/hypermedia-components/api/manifest.json',
              description:
                'components, behaviors, events, recipes, macros, i18n keys — generated from source, CI-verified',
            },
            {
              label: 'Custom Elements Manifest (JSON)',
              url: 'https://ingcreators.com/hypermedia-components/api/custom-elements.json',
              description: 'the two optional macro elements and their attributes',
            },
          ],
        }),
      ],
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
          label: 'Start', translations: { ja: 'はじめに' },
          items: [
            { slug: 'start/introduction' },
            { slug: 'start/installation' },
            { slug: 'start/quick-start' },
            { slug: 'start/philosophy' },
          ],
        },
        {
          // Explicit reading order (the index's suggested path), not the
          // alphabetical order autogenerate would produce.
          label: 'Fundamentals', translations: { ja: '基礎' },
          items: [
            { slug: 'fundamentals' },
            { slug: 'fundamentals/naming' },
            { slug: 'fundamentals/tokens' },
            { slug: 'fundamentals/layout' },
            { slug: 'fundamentals/responsive' },
            { slug: 'fundamentals/i18n' },
            { slug: 'fundamentals/accessibility' },
            { slug: 'fundamentals/print' },
            { slug: 'fundamentals/errors' },
          { slug: 'fundamentals/audit-trail' },
            { slug: 'fundamentals/writing' },
            { slug: 'fundamentals/motion' },
            { slug: 'fundamentals/icons' },
            { slug: 'fundamentals/anchored' },
          ],
        },
        { label: 'Kitchen sink', translations: { ja: 'キッチンシンク' }, slug: 'kitchen-sink' },
        {
          // Grouped by purpose instead of one flat ~50-entry alphabetical
          // list, so the sidebar is scannable. Every component lives under
          // exactly one category; `Overview` links the gallery index.
          label: 'Components', translations: { ja: 'コンポーネント' },
          items: [
            { label: 'Overview', translations: { ja: '概要' }, slug: 'components' },
            {
              label: 'Actions', translations: { ja: 'アクション' },
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
              label: 'Forms', translations: { ja: 'フォーム' },
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
                'components/rating',
                'components/range',
                'components/datepicker',
                'components/calendar',
                'components/dropzone',
                'components/attachment',
              ],
            },
            {
              label: 'Navigation', translations: { ja: 'ナビゲーション' },
              items: [
                'components/breadcrumb',
                'components/toc',
                'components/pagination',
                'components/stepper',
                'components/tabs',
                'components/menu',
                'components/menubar',
                'components/navmenu',
                'components/context-menu',
                'components/tree',
              ],
            },
            {
              label: 'Overlays', translations: { ja: 'オーバーレイ' },
              items: [
                'components/dialog',
                'components/drawer',
                'components/popover',
                'components/hovercard',
                'components/tooltip',
              ],
            },
            {
              label: 'Data display', translations: { ja: 'データ表示' },
              items: [
                'components/table',
                'components/code',
                'components/datagrid',
                'components/card',
                'components/item',
                'components/avatar',
                'components/badge',
                'components/chip',
                'components/filterbar',
                'components/separator',
                'components/accordion',
                'components/collapsible',
                'components/sparkline',
                'components/timeline',
                'components/chat',
              ],
            },
            {
              label: 'Feedback', translations: { ja: 'フィードバック' },
              items: [
                'components/alert',
                'components/toast',
                'components/progress',
                'components/meter',
                'components/spinner',
                'components/skeleton',
                'components/empty',
              ],
            },
            {
              label: 'Layout', translations: { ja: 'レイアウト' },
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
        { label: 'Blocks', translations: { ja: 'ブロック' }, slug: 'blocks' },
        {
          // Page-scale compositions — the layer above blocks. Explicit
          // order (overview → the two templates), Components-style
          // `Overview` entry for the index.
          label: 'Templates', translations: { ja: 'テンプレート' },
          items: [
            { label: 'Overview', translations: { ja: '概要' }, slug: 'templates' },
            'templates/settings',
            'templates/crud',
            'templates/data-grid-page',
            'templates/data-entry',
    'templates/confirm-page',
          ],
        },
        { label: 'Recipes', translations: { ja: 'レシピ' }, items: [{ autogenerate: { directory: 'recipes' } }] },
        {
          // The editor engine for visual builders — a separate npm
          // package, so its docs sit outside the core Reference group.
          // Explicit reading order: overview → API → inspector demo.
          label: 'Editor kit', translations: { ja: 'エディタキット' },
          items: [
            { label: 'Overview', translations: { ja: '概要' }, slug: 'editor-kit' },
            'editor-kit/api',
            'editor-kit/inspector',
          ],
        },
        { label: 'Tokens', translations: { ja: 'トークン' }, items: [{ autogenerate: { directory: 'tokens' } }] },
        { label: 'Integrations', translations: { ja: 'インテグレーション' }, items: [{ autogenerate: { directory: 'integrations' } }] },
        { label: 'Reference', translations: { ja: 'リファレンス' }, items: [{ autogenerate: { directory: 'reference' } }] },
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
                if (c === 'default' || c === 'teal' || c === 'lime' || c === 'orange' || c === 'fuchsia') {
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
  // Mount the recipe demo API in `astro dev` / `astro preview` on the
  // same /api/recipes/ prefix the Cloudflare Worker serves in
  // production, so the live demos on the recipe pages work locally.
  vite: {
    plugins: [demoApiDevPlugin()],
  },
});
