// Screenshots art-shots/gallery.html to art-shots/gallery.png (full page). Optional arg: output name.
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const out = process.argv[2] ?? "gallery";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
await page.goto("file://" + resolve(root, "art-shots/gallery.html"));
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(root, `art-shots/${out}.png`), fullPage: true });
await browser.close();
console.log(`art-shots/${out}.png`);
