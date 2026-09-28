import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { parse } from 'yaml';
import { createPost } from '../scripts/new-post.mjs';

test('new posts have portable folders, quoted metadata, Shanghai dates, and draft defaults', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'astro-new-post-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const title = 'A title: "quoted" # YAML';
  const filename = await createPost({
    root, slug: 'my-post', title, now: new Date('2026-09-28T17:00:00Z'),
  });
  assert.equal(filename, join(root, 'src', 'content', 'posts', '2026-09-29-my-post', 'index.md'));
  const text = await readFile(filename, 'utf8');
  const data = parse(text.split('---')[1]);
  assert.equal(data.title, title);
  assert.equal(data.permalink, '/2026/09/29/my-post/');
  assert.equal(data.draft, true);
  assert.ok((await stat(join(root, 'src', 'content', 'posts', '2026-09-29-my-post', 'images'))).isDirectory());
  await assert.rejects(createPost({
    root, slug: 'my-post', now: new Date('2026-09-28T17:00:00Z'),
  }), { code: 'EEXIST' });
  assert.equal(await readFile(filename, 'utf8'), text);
});

test('invalid slugs and empty titles are rejected before creating files', async () => {
  for (const slug of ['', '../escape', 'hello world', 'UPPERCASE', 'path/to/post', undefined]) {
    await assert.rejects(createPost({ slug }), /lowercase slug/);
  }
  await assert.rejects(createPost({ slug: 'valid', title: ' ' }), /must not be empty/);
});
