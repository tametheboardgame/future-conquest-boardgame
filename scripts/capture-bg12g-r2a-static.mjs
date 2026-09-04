import fs from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.BG12G_R2A_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.BG12G_R2A_OUTPUT ?? 'artifacts/bg12g-r2a-static';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const evidence = {
  schemaVersion: 1,
  package: 'BG12G-R2A',
  head: process.env.BG12G_R2A_REF ?? process.env.GITHUB_SHA ?? null,
  renderer: 'Three.js/WebGL',
  captures: []
};

try {
  for (let face = 1; face <= 6; face += 1) {
    const errors = [];
    const onConsole = message => {
      if (message.type() === 'error') errors.push(message.text());
    };
    const onPageError = error => errors.push(error.message);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    await page.goto(`${baseUrl}/?bg12g-r2a=1&face=${face}`, { waitUntil: 'networkidle' });
    const prototype = page.locator('[data-bg12g-r2a-prototype="true"]');
    await prototype.waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('canvas[data-bg12g-r2a-renderer="three"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction(expectedFace => {
      const canvas = document.querySelector('canvas[data-bg12g-r2a-renderer="three"]');
      const root = document.querySelector('[data-bg12g-r2a-prototype="true"]');
      return canvas?.getAttribute('data-face-up') === String(expectedFace)
        && root?.getAttribute('data-face-up') === String(expectedFace)
        && root?.getAttribute('data-renderer') === 'three';
    }, face);
    await page.waitForTimeout(180);

    const rendererInfo = await page.locator('canvas[data-bg12g-r2a-renderer="three"]').evaluate(canvas => {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      return gl ? {
        width: canvas.width,
        height: canvas.height,
        context: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl'
      } : null;
    });
    if (!rendererInfo) throw new Error(`face ${face}: Three.js canvas has no WebGL context`);

    const relevantErrors = errors.filter(error => !/favicon|ERR_ABORTED|Failed to load resource.*404/i.test(error));
    if (relevantErrors.length) throw new Error(`face ${face}: browser errors ${JSON.stringify(relevantErrors)}`);

    const file = `face-${face}.png`;
    await prototype.screenshot({ path: `${outputDir}/${file}` });
    evidence.captures.push({
      face,
      file,
      rendererInfo
    });

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
} finally {
  await context.close();
  await browser.close();
}

if (evidence.captures.length !== 6) {
  throw new Error(`expected six static D6 captures, got ${evidence.captures.length}`);
}

fs.writeFileSync(
  `${outputDir}/evidence.json`,
  `${JSON.stringify(evidence, null, 2)}\n`
);
console.log(`BG12G-R2A static capture complete: ${evidence.captures.map(item => item.face).join(', ')}.`);
