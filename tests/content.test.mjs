import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import test from 'node:test';
import { readPosts, root } from '../scripts/read-posts.mjs';

test('post permalinks are unique and use the published Shanghai date', async () => {
  const seen = new Set();
  for (const { filename, data } of await readPosts()) {
    assert.ok(data.title, filename);
    assert.match(data.permalink, /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/, filename);
    assert.ok(!seen.has(data.permalink), `Duplicate permalink: ${data.permalink}`);
    seen.add(data.permalink);
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(data.date));
    assert.equal(data.permalink.slice(1, 11), date.replaceAll('-', '/'), filename);
    assert.ok(Array.isArray(data.tags), filename);
  }
});

test('Markdown images are directly readable relative to their article', async () => {
  for (const { filename, body } of await readPosts()) {
    for (const match of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const url = match[1];
      if (/^https?:\/\//.test(url)) continue;
      assert.ok(url.startsWith('./') || url.startsWith('../'), `Nonportable image ${url} in ${filename}`);
      await access(resolve(dirname(filename), decodeURIComponent(url)));
    }
  }
});

test('legacy asset aliases use the same source bytes, not manually duplicated images', async () => {
  const aliases = JSON.parse(await readFile(join(root, 'scripts', 'legacy-assets.json'), 'utf8'));
  const posts = await readPosts();
  for (const alias of aliases) {
    const post = posts.find(({ filename }) => resolve(root, alias.source).startsWith(dirname(filename) + sep));
    assert.ok(post, `Missing post for ${alias.source}`);
    assert.ok(alias.destination.startsWith(post.data.permalink.slice(1)), alias.destination);
    await access(resolve(root, alias.source));
  }
});
