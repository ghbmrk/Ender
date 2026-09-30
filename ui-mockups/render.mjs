// Renders every mockup to ui-mockups/shots/*.png at 1920×1080.
// Usage: node ui-mockups/render.mjs [page ...]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };

const SHOTS = {
  hud: 'hud.html',
  'hud-boss': 'hud.html?boss=1',
  'realm-gate': 'realm-gate.html',
  crucible: 'crucible.html',
  bazaar: 'bazaar.html',
  'scene-room': 'scenes/scene.html?shot=room',
  'scene-boss': 'scenes/scene.html?shot=boss',
  'scene-shrine': 'scenes/scene.html?shot=shrine',
  'scene-room-colorblind': 'scenes/scene.html?shot=room&cb=1',
  'hud-on-scene': 'hud.html?bg=scene',
  'scene-lineup': 'scenes/scene.html?shot=lineup',
  'scene-room-spec': 'scenes/scene.html?shot=room&style=spec',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const wanted = process.argv.slice(2);
for (const [name, url] of Object.entries(SHOTS)) {
  if (wanted.length && !wanted.includes(name)) continue;
  const errors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/${url}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (url.startsWith('scenes/')) await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(root, 'shots', `${name}.png`) });
  console.log(`${name}.png${errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''}`);
}
await browser.close();
server.close();
