// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://faynshteynjuridico.com', // Actualizado a tu dominio
  output: 'static',
  integrations: [sitemap()],
  image: {
    domains: ['images.unsplash.com', 'v.ftcdn.net'],
  },
});
