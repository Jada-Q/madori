/**
 * Auto-record a silent operation demo of Madori's four views (for the hackathon
 * demo video). Drives web/madori.html through the DEMO_SCRIPT operations and
 * records it via Playwright (system Chrome). Output: web/demo/madori-demo.mp4
 *
 *   node pipeline/record_demo.mjs
 *
 * NOTE: this is the silent operation footage — add voiceover/intro/outro in edit.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(WEB, 'demo');
fs.mkdirSync(OUT, { recursive: true });

const ct = { '.html': 'text/html', '.png': 'image/png', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = path.join(WEB, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p = path.join(p, 'madori.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': ct[path.extname(p)] || 'text/plain' }); res.end(data);
  });
});
await new Promise(r => server.listen(8877, r));

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
});
const page = await ctx.newPage();
const SLOW = 1.9;                                   // slower pacing → room for voiceover per shot
const wait = ms => page.waitForTimeout(Math.round(ms * SLOW));
const clickId = async id => page.evaluate(i => document.getElementById(i)?.click(), id);
// 平滑绕模型转 90°（直接绕 target 旋转相机位置，不依赖 setAzimuthalAngle —— three@0.128 OrbitControls 无此法）
const orbitQuarter = () => page.evaluate(() => new Promise(res => {
  const tgt = controls.target, off = camera.position.clone().sub(tgt);
  const r = Math.hypot(off.x, off.z), y = off.y, a0 = Math.atan2(off.z, off.x), dur = 1400, t0 = performance.now();
  (function s(){ const t = Math.min(1,(performance.now()-t0)/dur), a = a0 + t*Math.PI/2;
    camera.position.set(tgt.x + r*Math.cos(a), tgt.y + y, tgt.z + r*Math.sin(a)); controls.update(); t<1?requestAnimationFrame(s):res(); })();
}));

console.log('▸ 录制中…');
await page.goto('http://localhost:8877/madori.html', { waitUntil: 'networkidle' });
await wait(500);   // 仅等 three.js 初始化，不留立体预卷

// ═══ 开场：先看平面 → 滑旋钮展开成立体 → 绕一圈看四个面 → 收回平面继续讲解 ═══
await clickId('tabRead');
// 1) 立刻摊平为平面 —— 开场第一眼就是「平面图」（砍掉默认立体预卷）
await page.evaluate(() => { const m = document.getElementById('morph'); m.value = 0; m.dispatchEvent(new Event('input')); }); await wait(2800);
// 2) 平滑展开 平面 → 立体（拖动 morph 旋钮）
await page.evaluate(() => new Promise(res => { const m = document.getElementById('morph'), t0 = performance.now(), dur = 2200;
  (function s(){ const t = Math.min(1,(performance.now()-t0)/dur); m.value = Math.round(t*100); m.dispatchEvent(new Event('input')); t<1?requestAnimationFrame(s):res(); })(); }));
await wait(1300);
// 3) 绕模型一圈，四个面各停一下
for (let i = 0; i < 4; i++) { await orbitQuarter(); await wait(1100); }
await wait(800);
// 4) 收回平面，回到二维继续讲解
await page.evaluate(() => new Promise(res => { const m = document.getElementById('morph'), t0 = performance.now(), dur = 1600;
  (function s(){ const t = Math.min(1,(performance.now()-t0)/dur); m.value = Math.round((1-t)*100); m.dispatchEvent(new Event('input')); t<1?requestAnimationFrame(s):res(); })(); }));
await wait(1200);

// ═══ 钩子：看不懂 → 一眼懂（最强对比）═══
// 1) 全屏源图：密密麻麻的户型图，"你看得懂吗？"
await page.evaluate(() => document.getElementById('planCard')?.click()); await wait(2400);
await page.evaluate(() => document.getElementById('lightbox')?.click()); await wait(700);
// 2) 切采光：一眼看到哪间采光好（反转！）
await clickId('tabDay'); await wait(2600);

// ═══ 采光高潮：转朝向实时重算（建筑师能力降维 + 算出来的事实）═══
for (const d of ['up', 'right', 'down', 'left']) {   // 北 / 东 / 南 / 西 四个朝向各操作一次 + 停顿看清重算
  await page.evaluate(dir => document.querySelector(`.cbtn[data-dir="${dir}"]`)?.click(), d);
  await wait(1900);
}
await wait(1400);

// ═══ 核心：五镜头文字解读（几位专家的眼睛）═══
await clickId('tabRead'); await wait(1600);
for (const k of ['动线', '采光', '无障碍', '走读', '批评']) {
  await page.evaluate(key => { const t = [...document.querySelectorAll('.lens')].find(e => e.dataset.k === key); t && t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, k);
  await wait(2200);
}
await page.evaluate(() => document.querySelector('.read .scroll')?.scrollTo({ top: 0, behavior: 'smooth' })); await wait(1100);

// 房间联动 + 面积 → 每间㎡
for (const i of [0, 2, 4]) {
  await page.evaluate(n => { const c = [...document.querySelectorAll('.chip')]; c[n] && c[n].dispatchEvent(new MouseEvent('mouseenter')); }, i); await wait(900);
}
await page.evaluate(() => { const c = [...document.querySelectorAll('.chip')]; c[0] && c[0].dispatchEvent(new MouseEvent('mouseleave')); });
await page.fill('#areaIn', '66'); await wait(2400);

// 动线 + 无障碍
await clickId('tabCirc'); await wait(2400);
await clickId('tabA11y'); await wait(2400);

await ctx.close();                                  // flush video
await browser.close();
server.close();

// rename + transcode to mp4
const webm = fs.readdirSync(OUT).filter(f => f.endsWith('.webm')).map(f => path.join(OUT, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const mp4 = path.join(OUT, 'demo-core.mp4');   // pure functional demo; record_cards.mjs wraps it with intro/outro → madori-demo.mp4
try {
  // -movflags +faststart: moov atom to the front, else web <video>/Finder-preview/streaming
  // show a BLANK screen until the whole file downloads. -profile:v main for max player compat.
  execSync(`ffmpeg -y -i "${webm}" -vf "scale=1440:900" -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 22 -movflags +faststart "${mp4}"`, { stdio: 'ignore' });
  console.log(`✓ ${path.relative(ROOT, mp4)}`);
} catch (e) {
  console.log(`✓ webm: ${path.relative(ROOT, webm)}（ffmpeg 转码失败，webm 可用）`);
}
