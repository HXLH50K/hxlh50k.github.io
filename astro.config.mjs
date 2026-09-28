import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
import legacyHeadings from './scripts/rehype-legacy-headings.mjs';
import { site } from './src/site.ts';

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    processor: unified({
      smartypants: false,
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [rehypeKatex, {
          // Older notes include Chinese annotations inside otherwise valid formulas.
          strict: (code) => code === 'unicodeTextInMathMode' ? 'ignore' : 'warn',
        }],
        legacyHeadings,
      ],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      langAlias: { JavaScript: 'javascript', cron: 'shellscript' },
    },
  },
});
