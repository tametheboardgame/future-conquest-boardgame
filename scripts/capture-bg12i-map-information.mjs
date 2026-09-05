import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BG12I_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.BG12I_OUTPUT_DIR ?? 'artifacts/bg12i';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function knownTerrainWarning(text = '') {
  return /Cannot read properties of undefined \(reading ['"]id['"]\)/i.test(text)
    && /(R3 terrain source warning|TerrainMapPrototype|setFeatureState|initializeTileState|_tileLoaded|_loadTile)/i.test(text);
}

const cases = [
  { id: 'wide', width: 1900, height: 829, minMapWidthRatio: 0.70, minMapHeightRatio: 0.58 },
  { id: 'laptop', width: 1366, height: 768, minMapWidthRatio: 0.70, minMapHeightRatio: 0.58 },
  { id: 'compact', width: 640, height: 900, minMapWidthRatio: 0.94, minMapHeightRatio: 0.60 }
];

const evidence = {
  schemaVersion: 1,
  head: process.env.BG12I_REF ?? process.env.GITHUB_SHA ?? null,
  cases: []
};

for (const reviewCase of cases) {
  const context = await browser.newContext({
    viewport: { width: reviewCase.width, height: reviewCase.height },
    reducedMotion: 'no-preference'
  });
  await context.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
  });

  const page = await context.newPage();
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  try {
    await page.goto(`${baseUrl}/?terrain=1`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
    await page.locator('.bg12e-tabletop-layout').waitFor({ state: 'visible', timeout: 30000 });

    const closeGuide = page.getByRole('button', { name: /close guide/i });
    if (await closeGuide.count() > 0 && await closeGuide.first().isVisible()) {
      await closeGuide.first().click();
    }

    const shell = page.locator('.r3-terrain-prototype-shell').first();
    await shell.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => {
      const root = document.querySelector('.r3-terrain-prototype-shell');
      return Number(root?.getAttribute('data-bg12i-formation-tokens') ?? 0) > 0
        && Number(root?.getAttribute('data-bg12i-control-tokens') ?? 0) > 0;
    }, null, { timeout: 30000 });

    const profile = await shell.getAttribute('data-terrain-profile');
    if (reviewCase.id === 'compact') assert(profile === 'compact', `compact case did not use compact terrain profile: ${profile}`);
    else assert(profile === 'full', `${reviewCase.id} case did not use full terrain profile: ${profile}`);

    const mapCanvas = page.locator('.maplibregl-canvas').first();
    await mapCanvas.waitFor({ state: 'visible', timeout: 10000 });
    const mapBox = await mapCanvas.boundingBox();
    assert(mapBox, `${reviewCase.id} MapLibre canvas has no measurable box`);
    assert(mapBox.width >= reviewCase.width * reviewCase.minMapWidthRatio,
      `${reviewCase.id} map width no longer dominates: ${JSON.stringify(mapBox)}`);
    assert(mapBox.height >= reviewCase.height * reviewCase.minMapHeightRatio,
      `${reviewCase.id} map height no longer dominates: ${JSON.stringify(mapBox)}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 2, `${reviewCase.id} horizontal overflow exceeded 2px: ${overflow}`);

    const toolbar = page.locator('.r3-terrain-prototype-toolbar').first();
    const toolbarBox = await toolbar.boundingBox();
    assert(toolbarBox && toolbarBox.width <= 330 && toolbarBox.height <= 82,
      `${reviewCase.id} terrain toolbar is not compact: ${JSON.stringify(toolbarBox)}`);
    assert(await toolbar.getByRole('button', { name: 'theatre', exact: true }).isVisible(), `${reviewCase.id} Theatre camera control missing`);
    assert(await toolbar.getByRole('button', { name: 'campaign', exact: true }).isVisible(), `${reviewCase.id} Campaign camera control missing`);
    assert(await toolbar.getByRole('button', { name: 'selected', exact: true }).isVisible(), `${reviewCase.id} Selected camera control missing`);
    assert(await toolbar.locator('.r3-terrain-layer-control').isVisible(), `${reviewCase.id} Layers utility missing`);

    const strategic = page.locator('.r3-strategic-information-control').first();
    const strategicBox = await strategic.boundingBox();
    assert(strategicBox && strategicBox.width <= 190 && strategicBox.height <= 92,
      `${reviewCase.id} strategic utility is still a large permanent panel: ${JSON.stringify(strategicBox)}`);
    assert(await strategic.locator('select').first().isVisible(), `${reviewCase.id} strategic view selector missing`);

    const mapKeyState = await page.locator('.r3-terrain-map-key').first().evaluate(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height, clip: style.clip, overflow: style.overflow };
    });
    assert(mapKeyState.width <= 2 && mapKeyState.height <= 2,
      `${reviewCase.id} permanent map key still consumes visual space: ${JSON.stringify(mapKeyState)}`);

    const formationToken = page.locator('.r3-terrain-task-group-marker[data-bg12i-readiness] .bg12i-formation-state').first();
    await formationToken.waitFor({ state: 'visible', timeout: 5000 });
    const formationMarker = page.locator('.r3-terrain-task-group-marker[data-bg12i-readiness]').first();
    const formationState = {
      id: await formationMarker.getAttribute('data-group-id'),
      readiness: await formationMarker.getAttribute('data-bg12i-readiness'),
      damage: await formationMarker.getAttribute('data-bg12i-damage'),
      supply: await formationMarker.getAttribute('data-bg12i-supply'),
      copy: (await formationToken.innerText()).replace(/\s+/g, ' ').trim()
    };
    assert(/^R\d+/.test(formationState.copy), `${reviewCase.id} formation readiness is not visible on the board token: ${JSON.stringify(formationState)}`);

    const controlTokens = page.locator('.r3-terrain-territory-label[data-bg12i-controller] > .bg12i-control-token');
    const controlCount = await controlTokens.count();
    assert(controlCount > 0, `${reviewCase.id} has no board-projected territory control tokens`);
    const controlGlyphs = await controlTokens.evaluateAll(nodes => [...new Set(nodes.map(node => node.textContent?.trim()).filter(Boolean))]);
    assert(controlGlyphs.every(glyph => ['●', '◆', '□'].includes(glyph)),
      `${reviewCase.id} control tokens do not use the locked non-colour glyph set: ${JSON.stringify(controlGlyphs)}`);

    const accessibleMap = page.getByRole('button', { name: '2D accessible map', exact: true });
    assert(await accessibleMap.isVisible(), `${reviewCase.id} accessible 2D map control is no longer reachable`);

    const firstMarker = page.locator('.r3-terrain-task-group-marker[data-bg12i-readiness]').first();
    const markerId = await firstMarker.getAttribute('data-group-id');
    await firstMarker.evaluate(node => node.click());
    await page.waitForFunction(id => document.querySelector('.bg12h-formation-interaction')?.getAttribute('data-selected-piece') === id,
      markerId, { timeout: 5000 });

    const beforeCamera = await page.evaluate(() => {
      const map = window.__r3TerrainMap;
      return map ? { zoom: map.getZoom(), center: map.getCenter().toArray() } : null;
    });
    assert(beforeCamera, `${reviewCase.id} MapLibre runtime was unavailable after token projection`);
    await page.mouse.move(mapBox.x + mapBox.width * 0.55, mapBox.y + mapBox.height * 0.55);
    await page.mouse.wheel(0, -220);
    await page.waitForTimeout(300);
    const afterCamera = await page.evaluate(() => {
      const map = window.__r3TerrainMap;
      return map ? { zoom: map.getZoom(), center: map.getCenter().toArray() } : null;
    });
    assert(afterCamera && Math.abs(afterCamera.zoom - beforeCamera.zoom) > 0.01,
      `${reviewCase.id} MapLibre zoom stopped responding after BG12I projection`);

    const relevantErrors = errors.filter(text => !knownTerrainWarning(text)
      && !/favicon|ERR_ABORTED|Failed to load resource.*404/i.test(text));
    assert(relevantErrors.length === 0, `${reviewCase.id} browser errors during BG12I review: ${JSON.stringify(relevantErrors)}`);

    const screenshot = `${reviewCase.id}-${reviewCase.width}x${reviewCase.height}.png`;
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });

    evidence.cases.push({
      id: reviewCase.id,
      viewport: { width: reviewCase.width, height: reviewCase.height },
      profile,
      mapBox,
      toolbarBox,
      strategicBox,
      overflow,
      formationState,
      controlCount,
      controlGlyphs,
      markerId,
      beforeCamera,
      afterCamera,
      screenshot
    });
  } finally {
    await context.close();
  }
}

fs.writeFileSync(path.join(outputDir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
await browser.close();
console.log(`BG12I browser review passed for ${evidence.cases.length} viewport cases.`);
