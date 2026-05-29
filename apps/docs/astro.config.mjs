import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://ingcreators.com',
  base: '/hypermedia-components',
  integrations: [
    starlight({
      title: 'Hypermedia Components',
      description:
        'Semantic components and recipes for hypermedia applications.',
      editLink: {
        baseUrl:
          'https://github.com/ingcreators/hypermedia-components/edit/main/apps/docs/',
      },
      social: {
        github: 'https://github.com/ingcreators/hypermedia-components',
      },
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
        { label: 'Fundamentals', autogenerate: { directory: 'fundamentals' } },
        { label: 'Kitchen sink', slug: 'kitchen-sink' },
        { label: 'Components', autogenerate: { directory: 'components' } },
        { label: 'Recipes', autogenerate: { directory: 'recipes' } },
        { label: 'Tokens', autogenerate: { directory: 'tokens' } },
        { label: 'Integrations', autogenerate: { directory: 'integrations' } },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
      ],
      customCss: [
        '@hypermedia-components/core/css',
        './src/styles/custom.css',
        './src/styles/preview.css',
      ],
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
