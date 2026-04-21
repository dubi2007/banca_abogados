// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://faynshteyn-abogados.vercel.app', // Ajustar a la URL final
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true }
  }),
  integrations: [sitemap()],
  image: {
    domains: ['images.unsplash.com', 'v.ftcdn.net'],
  },
});
