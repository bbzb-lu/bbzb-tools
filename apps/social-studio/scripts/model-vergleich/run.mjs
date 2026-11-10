// Modellvergleich Freistellen. Aufruf: node run.mjs <spikeDir> [msedge|chromium] [cpuRate] [filter]
// spikeDir enthält node_modules (transformers, playwright), models/ und photos/; Ergebnisse in results/.
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
const [dir, channel = 'msedge', rate = '1', filter = ''] = process.argv.slice(2);
const require = createRequire(path.join(dir, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg', '.onnx': 'application/octet-stream' };
const roots = { '/tf/': 'node_modules/@huggingface/transformers/dist/', '/ort/': 'node_modules/onnxruntime-web/dist/', '/common/': 'node_modules/onnxruntime-common/dist/esm/', '/models/': 'models/', '/photos/': 'photos/' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let file = u === '/' ? path.join(here, 'page.html') : null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) file = path.join(p === '/ort/' && process.env.ORT_DIR ? process.env.ORT_DIR : dir, p === '/ort/' && process.env.ORT_DIR ? '' : r, u.slice(p.length));
  if (!file || !existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream', 'content-length': statSync(file).size, 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(4599, r));
const jobs = [];
const extra = JSON.parse(process.env.EXTRA ?? '{}'); // z. B. {"size":512,"so":{"graphOptimizationLevel":"disabled"}}
const suffix = process.env.EXTRA ? '_' + (process.env.SUFFIX ?? 'extra') : '';
const photos = ['portrait.jpg', 'helmet.jpg', 'group.jpg', 'object.jpg', 'layout01.jpg'];
const models = [
  ['onnx-community/BiRefNet_lite-ONNX', 'fp16', 'birefnet'], ['onnx-community/BiRefNet_lite-ONNX', 'fp32', 'birefnet'],
  ['onnx-community/BiRefNet-ONNX', 'fp16', 'birefnet'],
  ['imgly/isnet-general-onnx', 'fp16', 'isnet'], ['imgly/isnet-general-onnx', 'fp32', 'isnet'],
  ['Xenova/modnet', 'q8', 'modnet'], ['Xenova/modnet', 'fp32', 'modnet'],
];
for (const [id, dtype, kind] of models) for (const device of ['webgpu', 'wasm']) {
  if (filter && !(id + dtype + device).includes(filter)) continue;
  for (const photo of photos) jobs.push({ id, dtype, device, photo, kind, ...extra });
}
const userDir = path.join(dir, 'profile-' + channel);
const args = ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--enable-webgpu-developer-features'];
const ctx = await chromium.launchPersistentContext(userDir, { channel: channel === 'chromium' ? undefined : channel, headless: false, args });
const rss = () => { try { return Math.round(execSync(`ps -axo rss=,args= | grep -F -- "${userDir}" | grep -v grep | awk '{s+=$1} END {print s}'`).toString() / 1024); } catch { return null; } };
// Ein Seitenaufruf pro Konfiguration: ein ORT-Abbruch (std::bad_alloc) vergiftet sonst alle weiteren Läufe der Seite.
let page, cdp, info, curKey = '';
const open = async () => {
  if (page) await page.close();
  page = await ctx.newPage();
  cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) });
  page.on('console', (m) => { const t = m.text(); if (/error|fail|alloc/i.test(t)) console.log('[page]', t.slice(0, 200)); });
  await page.goto('http://localhost:4599/');
  await page.waitForFunction(() => window.ready);
  info ??= await page.evaluate(async () => ({ ua: navigator.userAgent, webgpu: !!navigator.gpu && !!(await navigator.gpu.requestAdapter()), isolated: crossOriginIsolated, cores: navigator.hardwareConcurrency }));
};
await open();
console.log(JSON.stringify(info));
console.log('baselineRssMB', rss());
const log = [];
for (const j of jobs) {
  const k = [j.id, j.dtype, j.device, j.size].join('|'); if (k !== curKey) { await open(); curKey = k; }
  let peak = 0; const iv = setInterval(() => { peak = Math.max(peak, rss() ?? 0); }, 400);
  const r = await page.evaluate((x) => window.run(x), j);
  // zweiter Lauf = warm (Shader-Kompilierung und Initialisierung nicht mehr dabei)
  const r2 = r.error ? null : await page.evaluate((x) => window.run(x), j);
  clearInterval(iv);
  const tag = `${j.id.split('/')[1]}_${j.dtype}_${j.device}${suffix}_x${rate}`;
  if (r.png && j.device === (j.id.includes('modnet') ? 'wasm' : j.device)) {
    mkdirSync(path.join(dir, 'results', tag), { recursive: true });
    writeFileSync(path.join(dir, 'results', tag, j.photo.replace('.jpg', '.png')), Buffer.from(r.png, 'base64'));
  }
  const row = { tag, photo: j.photo, loadMs: r.loadMs, coldMs: r.inferMs, warmMs: r2?.inferMs, peakRssMB: peak, jsHeapMB: r.jsHeapMB, error: r.error };
  console.log(JSON.stringify(row)); log.push(row);
}
writeFileSync(path.join(dir, `log-${channel}${suffix}-x${rate}${filter ? '-' + filter : ''}.json`), JSON.stringify({ info, log }, null, 1));
await ctx.close(); server.close();
