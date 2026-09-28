import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = JSON.parse(await readFile(new URL('./legacy-assets.json', import.meta.url), 'utf8'));

// Keep existing image URLs working without maintaining a second copy of each source image.
for (const asset of assets) {
  const destination = resolve(root, 'dist', asset.destination);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, asset.source), destination);
}
console.log(`Preserved ${assets.length} legacy image URLs.`);
