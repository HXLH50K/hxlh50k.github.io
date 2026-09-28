import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { load } from 'cheerio';
import { listFiles, readPosts, root } from './read-posts.mjs';

const dist = join(root, 'dist');
const files = new Set((await listFiles(dist)).map((file) => relative(dist, file).replaceAll('\\', '/')));
const legacy = JSON.parse(await readFile(join(root, 'tests', 'fixtures', 'legacy-pages.json'), 'utf8'));
const legacyHeadings = JSON.parse(await readFile(join(root, 'scripts', 'legacy-headings.json'), 'utf8'));
for (const file of legacy) assert.ok(files.has(file), `Lost legacy URL: /${file}`);

const documents = new Map();
for (const file of files) {
  if (file.endsWith('.html')) documents.set(file, load(await readFile(join(dist, file), 'utf8')));
}

const origin = 'https://hxlh50k.github.io';
let localReferences = 0;
for (const [filename, $] of documents) {
  assert.equal($('html').attr('lang'), 'zh-CN', filename);
  assert.ok($('title').text(), `Missing title: ${filename}`);
  assert.equal($('main').length, 1, `Expected one main landmark: ${filename}`);
  assert.equal($('link[rel="canonical"]').length, 1, `Missing canonical URL: ${filename}`);
  const references = [];
  $('[href], [src]').each((_, element) => {
    const node = $(element);
    const attribute = node.attr('href') ?? node.attr('src');
    if (attribute) references.push(attribute);
  });
  $('[srcset]').each((_, element) => {
    const srcset = $(element).attr('srcset');
    for (const candidate of srcset.split(',')) references.push(candidate.trim().split(/\s+/)[0]);
  });
  const pageUrl = new URL('/' + filename.replace(/index\.html$/, ''), origin);
  for (const reference of references) {
    const url = new URL(reference, pageUrl);
    if (url.origin !== origin) continue;
    const pathname = decodeURIComponent(url.pathname).slice(1);
    const target = pathname.endsWith('/') || !pathname ? pathname + 'index.html' : pathname;
    assert.ok(files.has(target), `Broken local reference in ${filename}: ${reference} -> ${target}`);
    localReferences++;
    if (url.hash && documents.has(target)) {
      const targetDocument = documents.get(target);
      const id = decodeURIComponent(url.hash.slice(1));
      assert.ok(targetDocument('[id]').toArray().some((element) => targetDocument(element).attr('id') === id),
        `Missing anchor in ${filename}: ${reference}`);
    }
  }
  assert.equal($('script[src^="http"], iframe').length, 0, `Unexpected third-party script/embed: ${filename}`);
  assert.equal($('.katex-error').length, 0, `Invalid math in ${filename}: ${$('.katex-error').first().attr('title')}`);
}

for (const [url, headings] of Object.entries(legacyHeadings)) {
  const $ = documents.get(url.slice(1) + 'index.html');
  const ids = new Set($('[id]').toArray().map((element) => $(element).attr('id')));
  for (const heading of headings) assert.ok(ids.has(heading.id), `Lost legacy anchor: ${url}#${heading.id}`);
}

const rss = load(await readFile(join(dist, 'rss.xml'), 'utf8'), { xml: true });
const posts = await readPosts();
const published = posts.filter(({ data }) => !data.draft);
assert.equal(rss('item').length, published.length, 'RSS must include every published post, not drafts.');
for (const { data } of posts) {
  const target = data.permalink.slice(1) + 'index.html';
  if (data.draft) {
    assert.ok(!files.has(target), `Draft was published: ${target}`);
    continue;
  }
  const $ = documents.get(target);
  assert.ok($, `Missing post: ${target}`);
  assert.equal($('h1').first().text().trim(), data.title);
  assert.equal(decodeURIComponent($('link[rel="canonical"]').attr('href')), origin + data.permalink);
}

const aliases = JSON.parse(await readFile(join(root, 'scripts', 'legacy-assets.json'), 'utf8'));
for (const alias of aliases) {
  assert.deepEqual(await readFile(join(dist, alias.destination)), await readFile(resolve(root, alias.source)),
    `Legacy image changed: ${alias.destination}`);
}
const manifest = JSON.parse(await readFile(join(dist, 'favicon', 'site.webmanifest'), 'utf8'));
for (const icon of manifest.icons) assert.ok(files.has(icon.src.slice(1)), `Missing manifest icon: ${icon.src}`);
assert.ok(files.has('404.html'), 'GitHub Pages requires 404.html.');
assert.ok(files.has('sitemap-index.xml'), 'Missing sitemap.');
console.log(`Verified ${published.length} posts, ${legacy.length} legacy pages, ${aliases.length} legacy images, and ${localReferences} local references.`);
