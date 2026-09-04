import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.BG12G_R2E_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDir = 'artifacts/bg12g-r2e';
fs.mkdirSync(outputDir, { recursive: true });

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function serialisePageError(error) {
  return error?.stack || error?.message || String(error);
}

function isKnownTerrainTileStateWarning(error) {
  const undefinedFeatureId = /Cannot read properties of undefined \(reading ['"]id['"]\)/i.test(error);
  if (!undefinedFeatureId) return false;
  const taggedTerrainWarning = /R3 terrain source warning:/i.test(error)
    && /setFeatureState|initializeTileState|_tileLoaded|_loadTile/i.test(error);
  const mapLibreTileStateStack = /TerrainMapPrototype-[^\s)]+\.js/i.test(error)
    && /setFeatureState|initializeTileState|_tileLoaded|_loadTile/i.test(error);
  return taggedTerrainWarning || mapLibreTileStateStack;
}

function relevantErrors(errors) {
  return errors.filter(error =>
    !/favicon|ERR_ABORTED|Failed to load resource.*404/i.test(error)
    && !isKnownTerrainTileStateWarning(error)
  );
}

async function createContext(browser, { reducedMotion = 'no-preference', recordVideo = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    reducedMotion,
    ...(recordVideo ? { recordVideo: { dir: `${outputDir}/raw-video`, size: { width: 1600, height: 900 } } } : {})
  });
  await context.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
    window.__bg12gDiceReviewEvents = [];
    window.addEventListener('future-conquest:dice-clatter', event => {
      window.__bg12gDiceReviewEvents.push(event.detail);
    });
  });
  return context;
}

async function enterCampaign(page, query = '?terrain=1') {
  await page.goto(`${BASE_URL}/${query}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
  await page.locator('.bg12e-tabletop-layout').waitFor({ state: 'visible', timeout: 30000 });
  const closeGuide = page.getByRole('button', { name: /close guide/i });
  if (await closeGuide.count() > 0 && await closeGuide.first().isVisible()) await closeGuide.first().click();
}

async function openCombat(page) {
  await page.locator('.bg12e-rail-switcher').getByRole('button', { name: 'Combat', exact: true }).click();
  await page.locator('.tabletop-combat-panel[data-bg-dice-renderer="BG12G-R2C-THREE"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForFunction(() => {
    const select = document.querySelector('.tabletop-combat-attacker select');
    return select && !select.disabled;
  }, null, { timeout: 10000 });
}

async function selectLegalCombat(page) {
  const attackerSelect = page.locator('.tabletop-combat-attacker select');
  const attackerValues = await attackerSelect.locator('option').evaluateAll(options =>
    options.map(option => option.value).filter(Boolean)
  );
  let attacker = null;
  for (const value of attackerValues) {
    await attackerSelect.selectOption(value);
    await page.waitForTimeout(100);
    if (await page.locator('.tabletop-combat-targets button').count() > 0) {
      attacker = value;
      break;
    }
  }
  assert(attacker, 'no human formation exposed a legal authoritative combat target');
  const targetButton = page.locator('.tabletop-combat-targets button').first();
  const targetLabel = (await targetButton.innerText()).replace(/\s+/g, ' ').trim();
  await targetButton.click();
  await page.locator('.bg12g-pre-roll .bg12g-roll-button').waitFor({ state: 'visible', timeout: 5000 });
  return { attacker, targetLabel };
}

async function readAuthoritativeDice(page) {
  const root = page.locator('.bg12g-resolved-tray .bg12g-integrated-dice[data-authoritative="true"]');
  await root.waitFor({ state: 'visible', timeout: 5000 });
  const values = await root.evaluate(node => ({
    dieCount: Number(node.getAttribute('data-die-count')),
    left: Number(node.getAttribute('data-left-face')),
    right: Number(node.getAttribute('data-right-face')),
    total: Number(node.getAttribute('data-total')),
    renderer: node.getAttribute('data-renderer'),
    motionState: node.getAttribute('data-motion-state')
  }));
  assert(values.dieCount === 2, `expected exactly two integrated D6s, got ${values.dieCount}`);
  assert([values.left, values.right].every(value => Number.isInteger(value) && value >= 1 && value <= 6), `invalid authoritative D6 faces: ${JSON.stringify(values)}`);
  assert(values.total === values.left + values.right, `visible D6 total mismatch: ${JSON.stringify(values)}`);
  return values;
}

async function readEvents(page) {
  return page.evaluate(() => window.__bg12gDiceReviewEvents ?? []);
}

async function assertEventPair(page, dice) {
  const events = await readEvents(page);
  const starts = events.filter(event => event?.diceType === '2d6' && event?.phase === 'start');
  const settled = events.filter(event => event?.diceType === '2d6' && event?.phase === 'settled');
  assert(starts.length === 1, `expected one dice-clatter start event, got ${JSON.stringify(events)}`);
  assert(settled.length === 1, `expected one dice-clatter settled event, got ${JSON.stringify(events)}`);
  assert(Array.isArray(settled[0].dice) && settled[0].dice[0] === dice.left && settled[0].dice[1] === dice.right, `settled event faces diverged from authoritative renderer: ${JSON.stringify({ dice, events })}`);
  assert(settled[0].total === dice.total, `settled event total diverged from authoritative renderer: ${JSON.stringify({ dice, events })}`);
  return events;
}

async function runNormalCase(browser) {
  const context = await createContext(browser, { recordVideo: true });
  const page = await context.newPage();
  const video = page.video();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(serialisePageError(error)));
  try {
    await enterCampaign(page, '?terrain=1');
    const mapCanvas = page.locator('.maplibregl-canvas').first();
    await mapCanvas.waitFor({ state: 'visible', timeout: 30000 });
    await openCombat(page);
    const selection = await selectLegalCombat(page);
    await page.screenshot({ path: `${outputDir}/01-integrated-pre-roll.png`, fullPage: false });

    const startedAt = performance.now();
    await page.locator('.bg12g-pre-roll .bg12g-roll-button').click();
    await page.locator('.bg12g-resolved-tray.rolling').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.bg12g-resolved-tray canvas[data-bg12g-integrated-dice-renderer="three"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path: `${outputDir}/02-integrated-roll-start.png`, fullPage: false });
    await page.waitForTimeout(430);
    await page.screenshot({ path: `${outputDir}/03-integrated-roll-mid.png`, fullPage: false });
    await page.locator('.bg12g-resolved-tray.settled').waitFor({ state: 'visible', timeout: 5000 });
    const settledMs = performance.now() - startedAt;
    await page.waitForTimeout(100);
    const dice = await readAuthoritativeDice(page);
    assert(dice.renderer === 'three', `normal case did not use Three.js renderer: ${JSON.stringify(dice)}`);
    assert(dice.motionState === 'settled', `normal case renderer did not settle: ${JSON.stringify(dice)}`);
    const events = await assertEventPair(page, dice);
    const resultCopy = (await page.locator('.bg12g-resolved-tray').innerText()).replace(/\s+/g, ' ').trim();
    assert(resultCopy.includes(`${dice.left} + ${dice.right} = ${dice.total}`), `semantic result does not match authoritative dice: ${resultCopy}`);
    await page.screenshot({ path: `${outputDir}/04-integrated-roll-settled.png`, fullPage: false });

    const lifecycleAfterRoll = await page.evaluate(() => window.__bg12gDiceRendererLifecycle ?? null);
    assert(lifecycleAfterRoll && lifecycleAfterRoll.active >= 1, `missing active renderer lifecycle evidence: ${JSON.stringify(lifecycleAfterRoll)}`);

    const cycles = [];
    for (let index = 0; index < 4; index += 1) {
      await page.locator('.bg12e-rail-switcher').getByRole('button', { name: 'Cards', exact: true }).click();
      await page.waitForFunction(() => (window.__bg12gDiceRendererLifecycle?.active ?? -1) === 0, null, { timeout: 5000 });
      const disposed = await page.evaluate(() => ({ ...window.__bg12gDiceRendererLifecycle }));
      await page.locator('.bg12e-rail-switcher').getByRole('button', { name: 'Combat', exact: true }).click();
      await page.locator('.bg12g-resolved-tray .bg12g-integrated-dice').waitFor({ state: 'visible', timeout: 5000 });
      const mounted = await page.evaluate(() => ({ ...window.__bg12gDiceRendererLifecycle }));
      cycles.push({ disposed, mounted });
      assert(mounted.active === 1, `expected one live dice renderer after combat remount: ${JSON.stringify(mounted)}`);
      assert(mounted.created - mounted.disposed === mounted.active, `renderer lifecycle became unbalanced: ${JSON.stringify(mounted)}`);
    }

    await page.locator('.bg12e-rail-switcher').getByRole('button', { name: 'Cards', exact: true }).click();
    await page.waitForFunction(() => (window.__bg12gDiceRendererLifecycle?.active ?? -1) === 0, null, { timeout: 5000 });
    const lifecycleFinal = await page.evaluate(() => ({ ...window.__bg12gDiceRendererLifecycle }));
    assert(lifecycleFinal.created === lifecycleFinal.disposed, `dice WebGL contexts did not fully dispose: ${JSON.stringify(lifecycleFinal)}`);
    assert(lifecycleFinal.peak <= 2, `dice renderer lifecycle showed unbounded concurrent contexts: ${JSON.stringify(lifecycleFinal)}`);

    const box = await mapCanvas.boundingBox();
    assert(box && box.width > 400 && box.height > 250, `MapLibre canvas not usable after dice lifecycle stress: ${JSON.stringify(box)}`);
    const pointerEvents = await mapCanvas.evaluate(node => getComputedStyle(node).pointerEvents);
    assert(pointerEvents !== 'none', `MapLibre canvas lost pointer interaction after dice lifecycle stress: ${pointerEvents}`);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.wheel(0, -480);
    await page.mouse.move(box.x + box.width * 0.46, box.y + box.height * 0.48);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.54, box.y + box.height * 0.53, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(220);
    await page.screenshot({ path: `${outputDir}/05-map-after-dice-lifecycle.png`, fullPage: false });

    const knownTerrainWarnings = errors.filter(isKnownTerrainTileStateWarning);
    const browserErrors = relevantErrors(errors);
    assert(browserErrors.length === 0, `browser errors during integrated dice case: ${JSON.stringify(browserErrors)}`);
    return {
      ...selection,
      dice,
      events,
      resultCopy,
      settledMs,
      lifecycleAfterRoll,
      cycles,
      lifecycleFinal,
      mapBox: box,
      knownTerrainTileStateWarnings: knownTerrainWarnings.length
    };
  } finally {
    await context.close();
    if (video) {
      const rawVideo = await video.path();
      fs.copyFileSync(rawVideo, path.join(outputDir, 'bg12g-r2e-integrated-roll.webm'));
    }
  }
}

async function runReducedMotionCase(browser) {
  const context = await createContext(browser, { reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(serialisePageError(error)));
  try {
    await enterCampaign(page, '?terrain=0');
    await openCombat(page);
    await selectLegalCombat(page);
    const startedAt = performance.now();
    await page.locator('.bg12g-pre-roll .bg12g-roll-button').click();
    await page.locator('.bg12g-resolved-tray.settled').waitFor({ state: 'visible', timeout: 3000 });
    const settledMs = performance.now() - startedAt;
    const dice = await readAuthoritativeDice(page);
    const events = await assertEventPair(page, dice);
    assert(settledMs < 800, `reduced-motion settle took too long: ${settledMs.toFixed(1)}ms`);
    assert(relevantErrors(errors).length === 0, `reduced-motion browser errors: ${JSON.stringify(relevantErrors(errors))}`);
    await page.screenshot({ path: `${outputDir}/06-reduced-motion-settled.png`, fullPage: false });
    return { dice, events, settledMs };
  } finally {
    await context.close();
  }
}

async function runFallbackCase(browser) {
  const context = await createContext(browser);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(serialisePageError(error)));
  try {
    await enterCampaign(page, '?terrain=0&bg12g-force-dice-fallback=1');
    await openCombat(page);
    await selectLegalCombat(page);
    await page.locator('.bg12g-pre-roll .bg12g-roll-button').click();
    await page.locator('.bg12g-resolved-tray.settled').waitFor({ state: 'visible', timeout: 3000 });
    const dice = await readAuthoritativeDice(page);
    assert(dice.renderer === 'fallback', `forced fallback did not activate: ${JSON.stringify(dice)}`);
    await page.locator('.bg12g-resolved-tray [data-bg12g-dice-fallback="true"]').waitFor({ state: 'visible', timeout: 3000 });
    const events = await assertEventPair(page, dice);
    const copy = (await page.locator('.bg12g-resolved-tray').innerText()).replace(/\s+/g, ' ').trim();
    assert(copy.includes(`${dice.left} + ${dice.right} = ${dice.total}`), `fallback semantic result mismatch: ${copy}`);
    assert(relevantErrors(errors).length === 0, `fallback browser errors: ${JSON.stringify(relevantErrors(errors))}`);
    await page.screenshot({ path: `${outputDir}/07-forced-fallback-settled.png`, fullPage: false });
    return { dice, events, copy };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const normal = await runNormalCase(browser);
  const reducedMotion = await runReducedMotionCase(browser);
  const fallback = await runFallbackCase(browser);
  const evidence = {
    schemaVersion: 1,
    head: process.env.BG12G_R2E_REF ?? process.env.GITHUB_SHA ?? null,
    normal,
    reducedMotion,
    fallback,
    screenshots: [
      '01-integrated-pre-roll.png',
      '02-integrated-roll-start.png',
      '03-integrated-roll-mid.png',
      '04-integrated-roll-settled.png',
      '05-map-after-dice-lifecycle.png',
      '06-reduced-motion-settled.png',
      '07-forced-fallback-settled.png'
    ],
    video: 'bg12g-r2e-integrated-roll.webm'
  };
  fs.writeFileSync(`${outputDir}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`BG12G-R2E integrated evidence passed: ${normal.dice.left}+${normal.dice.right}=${normal.dice.total}; lifecycle ${normal.lifecycleFinal.created}/${normal.lifecycleFinal.disposed}; reduced ${reducedMotion.settledMs.toFixed(1)}ms; fallback ${fallback.dice.renderer}; known terrain tile-state warnings ${normal.knownTerrainTileStateWarnings}.`);
} finally {
  await browser.close();
}
