import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BG12G_R2B_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.BG12G_R2B_OUTPUT ?? 'artifacts/bg12g-r2b-motion';
const leftFace = 2;
const rightFace = 5;
const total = leftFace + rightFace;
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: `${outputDir}/raw-video`, size: { width: 1440, height: 900 } }
});

await context.addInitScript(() => {
  window.__bg12gR2bMotionEvents = [];
  window.addEventListener('future-conquest:bg12g-r2b-motion', event => {
    window.__bg12gR2bMotionEvents.push(event.detail);
  });
});

const page = await context.newPage();
const video = page.video();
const errors = [];
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));

const evidence = {
  schemaVersion: 1,
  package: 'BG12G-R2B',
  head: process.env.BG12G_R2B_REF ?? process.env.GITHUB_SHA ?? null,
  renderer: 'Three.js/WebGL',
  requestedDice: [leftFace, rightFace],
  total,
  screenshots: [],
  video: 'bg12g-r2b-motion.webm',
  events: []
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  await page.goto(`${baseUrl}/?bg12g-r2b=1&left=${leftFace}&right=${rightFace}&autoplay=1`, {
    waitUntil: 'domcontentloaded'
  });

  const prototype = page.locator('[data-bg12g-r2b-prototype="true"]');
  await prototype.waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('canvas[data-bg12g-r2b-renderer="three"]').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('[data-motion-state="rolling"]').waitFor({ state: 'visible', timeout: 5000 });

  await page.screenshot({ path: `${outputDir}/01-launch.png`, fullPage: false });
  evidence.screenshots.push('01-launch.png');

  await page.waitForTimeout(420);
  await page.screenshot({ path: `${outputDir}/02-flight.png`, fullPage: false });
  evidence.screenshots.push('02-flight.png');

  await page.waitForTimeout(430);
  await page.screenshot({ path: `${outputDir}/03-bounce.png`, fullPage: false });
  evidence.screenshots.push('03-bounce.png');

  await page.locator('[data-motion-state="settled"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${outputDir}/04-settled.png`, fullPage: false });
  evidence.screenshots.push('04-settled.png');

  const state = await prototype.evaluate(node => ({
    motionState: node.getAttribute('data-motion-state'),
    leftFace: Number(node.getAttribute('data-left-face')),
    rightFace: Number(node.getAttribute('data-right-face')),
    total: Number(node.getAttribute('data-total')),
    renderer: node.getAttribute('data-renderer')
  }));
  const events = await page.evaluate(() => window.__bg12gR2bMotionEvents ?? []);
  const relevantErrors = errors.filter(error => !/favicon|ERR_ABORTED|Failed to load resource.*404/i.test(error));

  assert(state.renderer === 'three', `R2B renderer did not initialise: ${JSON.stringify(state)}`);
  assert(state.motionState === 'settled', `R2B did not settle: ${JSON.stringify(state)}`);
  assert(state.leftFace === leftFace && state.rightFace === rightFace, `settled faces diverged: ${JSON.stringify(state)}`);
  assert(state.total === total, `settled total diverged: ${JSON.stringify(state)}`);
  assert(events.some(event => event?.phase === 'start' && event?.dice?.[0] === leftFace && event?.dice?.[1] === rightFace), `missing correct start event: ${JSON.stringify(events)}`);
  assert(events.some(event => event?.phase === 'settled' && event?.dice?.[0] === leftFace && event?.dice?.[1] === rightFace && event?.total === total), `missing correct settled event: ${JSON.stringify(events)}`);
  assert(relevantErrors.length === 0, `browser errors during R2B capture: ${JSON.stringify(relevantErrors)}`);

  evidence.events = events;
  evidence.finalState = state;
  fs.writeFileSync(`${outputDir}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  await page.waitForTimeout(300);
  console.log(`BG12G-R2B motion capture passed: ${leftFace}+${rightFace}=${total}.`);
} finally {
  await context.close();
  if (video) {
    const rawVideo = await video.path();
    fs.copyFileSync(rawVideo, path.join(outputDir, evidence.video));
  }
  await browser.close();
}
