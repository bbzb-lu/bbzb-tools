import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';

// transformers.js setzt als Vorgabe ein CDN für die onnxruntime-Dateien; der Worker liefert sie selbst aus (segmentWorker.ts).
// Hier fliegt die Adresse aus dem Build, und der Build bricht ab, wenn eine neue Version wieder ein CDN enthält.
const noCdn: Plugin = {
  name: 'kein-cdn',
  transform(code, id) {
    if (!/[\\/]node_modules[\\/](@huggingface[\\/]transformers|onnxruntime-web)[\\/]/.test(id)) return;
    const out = code.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@\$\{[^}]+\}\/dist\//, './');
    if (/cdn\.jsdelivr|unpkg\.com|cdnjs/.test(out)) this.error(`CDN-Adresse in ${id}`);
    return out;
  },
  // Cloudflare Pages nimmt höchstens 25 MiB je Datei (ORT-WASM heute 21,6 MB): bei über 24 MiB lieber hier scheitern als beim Deploy
  generateBundle(_, bundle) {
    for (const f of Object.values(bundle)) {
      const size = f.type === 'asset' ? f.source.length : f.code.length;
      if (size > 24 * 2 ** 20) this.error(`${f.fileName} ist ${(size / 2 ** 20).toFixed(1)} MiB, Cloudflare Pages erlaubt 25 MiB`);
    }
  },
};

// npm-Workspaces legen Pakete in den Hauptordner, darum den Ordner der ONNX-Laufzeit auflösen statt '../../node_modules/…' anzunehmen.
const ortDist = dirname(createRequire(createRequire(import.meta.url).resolve('@huggingface/transformers')).resolve('onnxruntime-web')); // dist/ort.node.min.js

export default defineConfig({
  base: '/social-studio/',
  plugins: [react(), noCdn],
  worker: { plugins: () => [noCdn] },
  resolve: { alias: { '@ort-dist': ortDist } },
  build: {
    outDir: '../../dist/social-studio',
    emptyOutDir: false, // das Leeren macht scripts/build.mjs
  },
  test: { exclude: ['e2e/**', 'node_modules/**'] },
});
