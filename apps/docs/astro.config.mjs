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
    }),
  ],
});
