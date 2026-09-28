import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createPost({ slug, title = slug, now = new Date(), root = process.cwd() }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? '')) {
    throw new Error('Use a lowercase slug such as: npm run new -- my-post "My title"');
  }
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('The post title must not be empty.');
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const date = ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type).value).join('-');
  const directory = join(root, 'src', 'content', 'posts', `${date}-${slug}`);
  await mkdir(directory, { recursive: true });
  const filename = join(directory, 'index.md');
  await writeFile(filename, [
    '---',
    `title: ${JSON.stringify(title.trim())}`,
    'description: ""',
    `date: "${date}T00:00:00+08:00"`,
    `permalink: "/${date.replaceAll('-', '/')}/${slug}/"`,
    'tags: []',
    'draft: true',
    '---',
    '',
    '',
  ].join('\n'), { flag: 'wx' });
  await mkdir(join(directory, 'images'), { recursive: true });
  return filename;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [slug, title, ...extra] = process.argv.slice(2);
    if (extra.length) throw new Error('Wrap the title in quotes: npm run new -- my-post "My title"');
    const filename = await createPost({ slug, title });
    console.log(`Created draft: ${filename}\nSet draft: false when ready to publish.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
