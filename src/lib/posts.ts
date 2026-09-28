import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '../site';

export type Post = CollectionEntry<'posts'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  const paths = new Set<string>();
  for (const post of posts) {
    if (paths.has(post.data.permalink)) {
      throw new Error(`Duplicate post permalink: ${post.data.permalink}`);
    }
    paths.add(post.data.permalink);
  }
  return posts.sort((a, b) => (
    b.data.date.getTime() - a.data.date.getTime()
    || a.data.permalink.localeCompare(b.data.permalink, 'zh-CN')
  ));
}

export function postUrl(post: Post): string {
  return post.data.permalink.split('/').map(encodeURIComponent).join('/');
}

export function dateParts(date: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: site.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((item) => item.type === type)?.value;
    if (!value) throw new Error(`Missing ${type} in date: ${date.toISOString()}`);
    return value;
  };
  return { year: part('year'), month: part('month'), day: part('day') };
}

export function formatDate(date: Date): string {
  const { year, month, day } = dateParts(date);
  return `${year}-${month}-${day}`;
}

export function tagSlug(name: string): string {
  return name.trim().replace(/[\s./\\]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function tagUrl(name: string): string {
  return `/tags/${encodeURIComponent(tagSlug(name))}/`;
}

export function getTags(posts: Post[]): { name: string; slug: string; posts: Post[] }[] {
  const tags = new Map<string, { name: string; slug: string; posts: Post[] }>();
  for (const post of posts) {
    for (const name of new Set(post.data.tags)) {
      const slug = tagSlug(name);
      if (!slug) throw new Error(`Empty tag slug for "${name}" in ${post.id}`);
      const existing = tags.get(slug);
      if (existing && existing.name !== name) {
        throw new Error(`Tags "${existing.name}" and "${name}" share the slug "${slug}".`);
      }
      if (existing) existing.posts.push(post);
      else tags.set(slug, { name, slug, posts: [post] });
    }
  }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
