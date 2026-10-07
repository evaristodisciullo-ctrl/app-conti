import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const out = new URL('../www/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
  entryPoints: [new URL('./app.js', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  outfile: new URL('app.js', out).pathname,
  minify: true,
  sourcemap: false,
});
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('./app.css', import.meta.url), 'utf8');
await writeFile(new URL('index.html', out), html);
await writeFile(new URL('app.css', out), css);
await cp(new URL('../assets', import.meta.url), new URL('assets', out), { recursive: true });
const jsPath = new URL('app.js', out);
const js = await readFile(jsPath, 'utf8');
await writeFile(jsPath, js.replaceAll('../assets/', './assets/'));
