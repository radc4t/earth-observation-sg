// build.mjs — production build. Bundles + minifies the app into dist/.
//
// The dev experience stays build-free (open index.html on source with a static server).
// This is only for optimized deployment: `npm run build` (or `npm run preview`).
//
// Output:
//   dist/bundle.js       all JS modules bundled + minified (entry: js/app.js)
//   dist/style.min.css   minified CSS
//   dist/assets/         copied overlay PNGs (loaded at runtime)
//   dist/index.html      index.html with local css/js paths rewritten to the built files
//
// Leaflet stays a CDN global (`L`): it is never imported, so esbuild emits a bare `L`
// reference that resolves to window.L at runtime — the CDN's classic <script> runs before
// the deferred module bundle, so L exists first. Nothing to externalize.

import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  // 1. JS bundle (entry js/app.js pulls in every module).
  await build({
    entryPoints: [resolve(root, 'js/app.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2020'],
    outfile: resolve(dist, 'bundle.js'),
    logLevel: 'info',
  });

  // 2. CSS minify. The `file` loader copies each @font-face woff2 into dist/ with a
  //    content-hashed name and rewrites its url() to a CSS-relative path, so the
  //    self-hosted fonts resolve correctly under the Pages sub-path (not just at root).
  await build({
    entryPoints: [resolve(root, 'css/style.css')],
    bundle: true,
    minify: true,
    loader: { '.woff2': 'file' },
    outfile: resolve(dist, 'style.min.css'),
    logLevel: 'info',
  });

  // 3. Copy runtime assets (the overlay PNGs the app fetches). Skip assets/fonts —
  //    esbuild's file loader (step 2) already emitted hashed copies referenced by the CSS,
  //    so copying the originals too would ship them twice.
  await cp(resolve(root, 'assets'), resolve(dist, 'assets'), {
    recursive: true,
    filter: (src) => !src.replace(/\\/g, '/').includes('/assets/fonts'),
  });

  // 4. Emit dist/index.html pointing at the built files (Leaflet CDN tags kept as-is,
  //    and the CDN <script> stays above the module bundle so window.L loads first).
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const out = html
    .replace('href="css/style.css"', 'href="style.min.css"')
    .replace('src="js/app.js"', 'src="bundle.js"');
  if (out === html) {
    throw new Error('index.html asset paths not found — did the css/js references change?');
  }
  await writeFile(resolve(dist, 'index.html'), out);

  console.log('Build complete → dist/ (bundle.js, style.min.css, index.html, assets/)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
