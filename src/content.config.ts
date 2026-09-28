import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().default(''),
    excerpt: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string().min(1)).default([]),
    author: z.string().optional(),
    permalink: z.string().regex(
      /^\/\d{4}\/\d{2}\/\d{2}\/[^/\\?#%<>:"|*]+\/$/,
      'Use a decoded /YYYY/MM/DD/slug/ permalink.',
    ).refine((value) => !['.', '..'].includes(value.split('/')[4] ?? ''), 'Use a valid article slug.'),
    draft: z.boolean().default(false),
    catalog: z.boolean().default(true),
  }),
});

export const collections = { posts };
