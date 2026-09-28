import rss from '@astrojs/rss';
import { getPosts, postUrl } from '../lib/posts';
import { site } from '../site';

export async function GET() {
  const posts = await getPosts();
  return rss({
    title: site.title,
    description: site.description,
    site: site.url,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt || post.data.description,
      link: postUrl(post),
      categories: post.data.tags,
    })),
    customData: `<language>${site.language}</language>`,
  });
}
