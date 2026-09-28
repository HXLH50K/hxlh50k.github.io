import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const root = fileURLToPath(new URL('../', import.meta.url));

export async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(filename));
    else if (entry.isFile()) files.push(filename);
  }
  return files;
}

export async function readPosts() {
  const files = await listFiles(join(root, 'src', 'content', 'posts'));
  return Promise.all(files.filter((filename) => filename.endsWith('index.md')).map(async (filename) => {
    const text = (await readFile(filename, 'utf8')).replace(/\r\n/g, '\n');
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) throw new Error(`Missing frontmatter: ${relative(root, filename)}`);
    return { filename, data: parse(match[1]), body: match[2] };
  }));
}
