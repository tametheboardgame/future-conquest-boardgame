import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BG12H_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.BG12H_OUTPUT_DIR ?? 'artifacts/bg12h';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  reducedMotion: 'no-preference',
  recordVideo: { dir: path.join(outputDir, 'raw-video'), size: { width: 1600, height: 900 } }
});

await context.addInitScript(() => {
  localStorage.setItem('future-conquest:intro-seen:v3', 'true');
  localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
  window.__bg12hDiceEvents = [];
  window.addEventListener('future-conquest:dice-clatter', event => {
    window.__bg12hDiceEvents.push(event.detail);
  });
});

const page = await context.newPage();
const video = page.video();
const browserErrors = [];
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push({ type: 'console', text: message.text() });
});
page.on('pageerror', error => {
  browserErrors.push({ type: 'pageerror', text: `${error.message}\n${error.stack ?? ''}` });
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function isKnownTerrainTileStateWarning(error) {
  const text = error.text ?? '';
  return /Cannot read properties of undefined \(reading ['"]id['"]\)/i.test(text)
    && /(R3 terrain source warning|TerrainMapPrototype|setFeatureState|initializeTileState|_tileLoaded|_loadTile)/i.test(text);
}

let evidence;

try {
  await page.goto(`${baseUrl}/?terrain=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
  await page.locator('.bg12e-tabletop-layout').waitFor({ state: 'visible', timeout: 30000 });

  const closeGuide = page.getByRole('button', { name: /close guide/i });
  if (await closeGuide.count() > 0 && await closeGuide.first().isVisible()) {
    await closeGuide.first().click();
  }

  const actionsTab = page.locator('.bg12e-rail-switcher').getByRole('button', { name: 'Actions', exact: true });
  await actionsTab.waitFor({ state: 'visible', timeout: 10000 });
  await actionsTab.click();
  await page.locator('.bg12h-formation-interaction[data-bg-package="BG12H"]').waitFor({ state: 'visible', timeout: 10000 });

  assert(await page.locator('.bg12e-rail-switcher').getByRole('button', { name: 'Combat', exact: true }).count() === 0,
    'normal BG12H route unexpectedly exposes the retired permanent Combat tab');
  assert(await page.locator('.bg12e-rail-switcher').getByRole('button', { name: 'Turn', exact: true }).count() === 0,
    'normal BG12H route unexpectedly exposes the retired permanent Turn tab');
  assert(await page.locator('.bg12e-rail-switcher').getByRole('button', { name: 'Support', exact: true }).count() === 0,
    'normal BG12H route unexpectedly exposes the retired permanent Support tab');

  await page.screenshot({ path: path.join(outputDir, '01-board-ready.png'), fullPage: false });

  await page.waitForFunction(() => document.querySelectorAll('.r3-terrain-task-group-marker[data-group-id]').length > 0, null, { timeout: 30000 });
  const markerIds = await page.locator('.r3-terrain-task-group-marker[data-group-id]').evaluateAll(nodes =>
    [...new Set(nodes.map(node => node.getAttribute('data-group-id')).filter(Boolean))]
  );
  assert(markerIds.length > 0, 'no terrain formation markers were available for BG12H selection');

  let attacker = null;
  for (const id of markerIds) {
    const marker = page.locator(`.r3-terrain-task-group-marker[data-group-id="${id}"]`).first();
    if (await marker.count() === 0) continue;
    await marker.evaluate(node => node.click());
    await page.waitForTimeout(100);

    const selected = await page.locator('.bg12h-formation-interaction').getAttribute('data-selected-piece');
    if (selected !== id) continue;

    const attackButton = page.locator('.bg12h-action-row').getByRole('button', { name: 'Attack', exact: true });
    if (await attackButton.count() === 0 || await attackButton.isDisabled()) continue;

    attacker = id;
    break;
  }
  assert(attacker, `no selectable human formation exposed an enabled contextual Attack action: ${JSON.stringify(markerIds)}`);

  const interaction = page.locator('.bg12h-formation-interaction');
  assert(await interaction.getAttribute('data-selected-piece') === attacker, 'selected formation identity was not retained in the contextual surface');
  assert(await interaction.getAttribute('data-action-mode') === 'select', 'formation selection did not return the contextual action row');
  await page.screenshot({ path: path.join(outputDir, '02-formation-selected.png'), fullPage: false });

  await page.locator('.bg12h-action-row').getByRole('button', { name: 'Attack', exact: true }).click();
  await page.locator('.bg12h-contextual-combat').waitFor({ state: 'visible', timeout: 5000 });
  assert(await interaction.getAttribute('data-action-mode') === 'attack', 'Attack did not enter contextual attack mode');
  assert(await page.locator('.tabletop-combat-panel[data-bg-dice-model="BG12G-R-2D6"]').isVisible(),
    'contextual Attack did not compose the accepted authoritative BG12G-R combat panel');

  await page.waitForFunction(expected => {
    const select = document.querySelector('.bg12h-contextual-combat .tabletop-combat-attacker select');
    return select && !select.disabled && select.value === expected;
  }, attacker, { timeout: 5000 });

  const attackerSelect = page.locator('.bg12h-contextual-combat .tabletop-combat-attacker select');
  assert(await attackerSelect.inputValue() === attacker, 'contextual Attack failed to bind the selected formation as attacker');

  const targetButton = page.locator('.bg12h-contextual-combat .tabletop-combat-targets button').first();
  await targetButton.waitFor({ state: 'visible', timeout: 5000 });
  const targetLabel = (await targetButton.innerText()).replace(/\s+/g, ' ').trim();
  await targetButton.click();

  await page.locator('.bg12h-contextual-combat .bg12g-pre-roll .bg12g-roll-button').waitFor({ state: 'visible', timeout: 5000 });
  const previewCopy = (await page.locator('.bg12h-contextual-combat .bg12g-pre-roll').innerText()).replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: path.join(outputDir, '03-attack-ready.png'), fullPage: false });

  await page.locator('.bg12h-contextual-combat .bg12g-pre-roll .bg12g-roll-button').click();
  await page.locator('.bg12h-contextual-combat .bg12g-resolved-tray.rolling').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(outputDir, '04-attack-rolling.png'), fullPage: false });
  await page.locator('.bg12h-contextual-combat .bg12g-resolved-tray.settled').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outputDir, '05-attack-settled.png'), fullPage: false });

  const dice = await page.locator('.bg12h-contextual-combat .bg12g-resolved-tray .bg12g-d6-stage').evaluateAll(nodes =>
    nodes.map(node => Number(node.getAttribute('data-authoritative-result')))
  );
  const events = await page.evaluate(() => window.__bg12hDiceEvents ?? []);
  const settled = events.find(event => event?.diceType === '2d6' && event?.phase === 'settled');
  assert(dice.length === 2 && dice.every(value => Number.isInteger(value) && value >= 1 && value <= 6),
    `invalid authoritative D6 faces after contextual attack: ${JSON.stringify(dice)}`);
  assert(events.some(event => event?.diceType === '2d6' && event?.phase === 'start'),
    `contextual attack emitted no 2D6 start event: ${JSON.stringify(events)}`);
  assert(settled, `contextual attack emitted no 2D6 settled event: ${JSON.stringify(events)}`);
  assert(Array.isArray(settled.dice) && settled.dice[0] === dice[0] && settled.dice[1] === dice[1],
    `contextual attack settled event diverged from visible dice: ${JSON.stringify({ dice, settled })}`);
  assert(settled.total === dice[0] + dice[1],
    `contextual attack settled total diverged from visible dice: ${JSON.stringify({ dice, settled })}`);

  await page.waitForFunction(() => {
    const surface = document.querySelector('.bg12h-formation-interaction');
    return surface?.getAttribute('data-selected-piece') === '' && surface?.getAttribute('data-action-mode') === 'select';
  }, null, { timeout: 5000 });
  await page.screenshot({ path: path.join(outputDir, '06-returned-to-board.png'), fullPage: false });

  const mapCanvas = page.locator('.maplibregl-canvas').first();
  await mapCanvas.waitFor({ state: 'visible', timeout: 5000 });
  const mapBox = await mapCanvas.boundingBox();
  assert(mapBox && mapBox.width > 800 && mapBox.height > 500,
    `MapLibre canvas no longer dominates the board after contextual combat: ${JSON.stringify(mapBox)}`);
  await page.mouse.move(mapBox.x + mapBox.width * 0.55, mapBox.y + mapBox.height * 0.55);
  await page.mouse.wheel(0, -180);
  await page.mouse.down();
  await page.mouse.move(mapBox.x + mapBox.width * 0.58, mapBox.y + mapBox.height * 0.58, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const knownTerrainWarnings = browserErrors.filter(isKnownTerrainTileStateWarning);
  const relevantErrors = browserErrors.filter(error => !isKnownTerrainTileStateWarning(error)
    && !/favicon|ERR_ABORTED|Failed to load resource.*404/i.test(error.text ?? ''));
  assert(relevantErrors.length === 0, `browser errors during BG12H contextual interaction: ${JSON.stringify(relevantErrors)}`);

  evidence = {
    schemaVersion: 1,
    head: process.env.BG12H_REF ?? process.env.GITHUB_SHA ?? null,
    attacker,
    targetLabel,
    previewCopy,
    dice,
    total: settled.total,
    clatterEvents: events,
    knownTerrainWarnings: knownTerrainWarnings.length,
    mapBox,
    retiredRailTabsAbsent: true,
    collapsedAfterResolution: true,
    screenshots: [
      '01-board-ready.png',
      '02-formation-selected.png',
      '03-attack-ready.png',
      '04-attack-rolling.png',
      '05-attack-settled.png',
      '06-returned-to-board.png'
    ],
    video: 'bg12h-contextual-formation.webm'
  };

  fs.writeFileSync(path.join(outputDir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`BG12H contextual browser capture passed: ${attacker} -> ${targetLabel}, ${dice.join('+')} = ${settled.total}.`);
} finally {
  await context.close();
  if (video) {
    const rawVideo = await video.path();
    fs.copyFileSync(rawVideo, path.join(outputDir, 'bg12h-contextual-formation.webm'));
  }
  await browser.close();
}
