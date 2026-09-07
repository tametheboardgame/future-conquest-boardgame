import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BG12K_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.BG12K_OUTPUT_DIR ?? 'artifacts/bg12k';
fs.mkdirSync(outputDir, { recursive: true });

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function knownTerrainWarning(text = '') {
  return /Cannot read properties of undefined \(reading ['"]id['"]\)/i.test(text)
    && /(R3 terrain source warning|TerrainMapPrototype|setFeatureState|initializeTileState|_tileLoaded|_loadTile)/i.test(text);
}

const cases = [
  { id: 'wide', width: 1900, height: 829, maxDrawerWidth: 450 },
  { id: 'laptop', width: 1366, height: 768, maxDrawerWidth: 450 },
  { id: 'compact', width: 640, height: 900, maxDrawerWidth: 380 }
];

const browser = await chromium.launch({ headless: true });
const evidence = {
  schemaVersion: 1,
  head: process.env.BG12K_REF ?? process.env.GITHUB_SHA ?? null,
  cases: []
};

async function waitForGameBoard(page) {
  await page.locator('.startup-game-shell').waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.startup-game-shell')?.classList.contains('launcher-covered'), null, { timeout: 20000 });
  await page.locator('.r3-portal-arrival').waitFor({ state: 'detached', timeout: 90000 }).catch(() => {});

  const tutorialSkip = page.getByRole('button', { name: 'Skip tutorial', exact: true });
  if (await tutorialSkip.count() && await tutorialSkip.isVisible().catch(() => false)) {
    await tutorialSkip.click();
    await page.locator('.tutorial-guide').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  }

  await page.locator('.command-stage-map').waitFor({ state: 'attached', timeout: 20000 });
  await page.locator('.command-map-workspace').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1200);
}

async function readAideState(page, drawerSelector) {
  return page.evaluate(selector => {
    const drawer = document.querySelector(selector);
    const boardZone = document.querySelector('.bg12e-board-zone');
    const underlay = document.querySelector('.bg12e-board-zone > .bg12k-map-underlay');
    const settingsToggle = document.querySelector('.global-settings-toggle');
    const commandNavigation = document.querySelector('.command-navigation');
    const backdrop = document.querySelector('.global-settings-backdrop');
    const singleAideCount = document.querySelectorAll('.forces-view, .campaign-view, .global-settings-panel').length;
    const box = element => {
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        overflowY: style.overflowY,
        pointerEvents: style.pointerEvents,
        backgroundColor: style.backgroundColor
      };
    };

    return {
      drawer: box(drawer),
      boardZone: box(boardZone),
      underlay: box(underlay),
      underlayCount: document.querySelectorAll('.bg12e-board-zone > .bg12k-map-underlay').length,
      underlayAriaHidden: underlay?.getAttribute('aria-hidden') ?? null,
      underlayInert: underlay?.hasAttribute('inert') ?? false,
      underlayVisualNodeCount: underlay?.querySelectorAll('canvas, svg').length ?? 0,
      singleAideCount,
      settingsToggleDisplay: settingsToggle instanceof HTMLElement ? getComputedStyle(settingsToggle).display : null,
      navigationPointerEvents: commandNavigation instanceof HTMLElement ? getComputedStyle(commandNavigation).pointerEvents : null,
      backdropPointerEvents: backdrop instanceof HTMLElement ? getComputedStyle(backdrop).pointerEvents : null,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  }, drawerSelector);
}

function assertCommonDrawerState(reviewCase, state, side) {
  assert(state.drawer, `${reviewCase.id} ${side} drawer missing measurable box`);
  assert(state.drawer.display !== 'none' && state.drawer.visibility === 'visible' && state.drawer.opacity > 0,
    `${reviewCase.id} ${side} drawer is not visible: ${JSON.stringify(state.drawer)}`);
  assert(state.drawer.width <= reviewCase.maxDrawerWidth,
    `${reviewCase.id} ${side} drawer exceeds width budget: ${JSON.stringify(state.drawer)}`);
  assert(state.drawer.height < reviewCase.height,
    `${reviewCase.id} ${side} drawer consumes the full viewport height: ${JSON.stringify(state.drawer)}`);
  assert(['auto', 'scroll'].includes(state.drawer.overflowY),
    `${reviewCase.id} ${side} drawer is not internally scrollable: ${state.drawer.overflowY}`);
  assert(state.singleAideCount === 1,
    `${reviewCase.id} ${side} drawer stacked with another secondary aide: ${state.singleAideCount}`);
  assert(state.horizontalOverflow <= 2,
    `${reviewCase.id} ${side} horizontal overflow exceeded 2px: ${state.horizontalOverflow}`);
}

function assertUnderlay(reviewCase, state, side) {
  assert(state.underlayCount === 1, `${reviewCase.id} ${side} did not preserve exactly one board underlay`);
  assert(state.underlay && state.boardZone, `${reviewCase.id} ${side} board underlay could not be measured`);
  assert(state.underlayAriaHidden === 'true' && state.underlayInert,
    `${reviewCase.id} ${side} board underlay is not inert/aria-hidden`);
  assert(state.underlay.pointerEvents === 'none', `${reviewCase.id} ${side} board underlay accepts pointer input`);
  assert(state.underlayVisualNodeCount > 0, `${reviewCase.id} ${side} board underlay contains no canvas or SVG map content`);
  assert(Math.abs(state.underlay.x - state.boardZone.x) <= 2
    && Math.abs(state.underlay.y - state.boardZone.y) <= 2
    && Math.abs(state.underlay.width - state.boardZone.width) <= 2
    && Math.abs(state.underlay.height - state.boardZone.height) <= 2,
  `${reviewCase.id} ${side} board underlay does not cover the board zone: ${JSON.stringify({ underlay: state.underlay, boardZone: state.boardZone })}`);
}

for (const reviewCase of cases) {
  const context = await browser.newContext({
    viewport: { width: reviewCase.width, height: reviewCase.height },
    reducedMotion: 'no-preference'
  });
  await context.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.removeItem('future-conquest-bg11-onboarding-v1');
    sessionStorage.removeItem('future-conquest:r3-wp39c-arrival-played');
  });

  const page = await context.newPage();
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error' && !knownTerrainWarning(message.text())) errors.push(message.text());
  });
  page.on('pageerror', error => {
    if (!knownTerrainWarning(error.message)) errors.push(error.message);
  });

  try {
    await page.goto(`${baseUrl}/?terrain=1`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
    await waitForGameBoard(page);

    const baseline = await readAideState(page, '.command-map-workspace');
    assert(baseline.singleAideCount === 0, `${reviewCase.id} baseline unexpectedly has a secondary aide`);
    assert(baseline.underlayCount === 0, `${reviewCase.id} baseline retained a stale board underlay`);
    assert(baseline.horizontalOverflow <= 2, `${reviewCase.id} baseline horizontal overflow exceeded 2px: ${baseline.horizontalOverflow}`);
    await page.screenshot({ path: path.join(outputDir, `${reviewCase.id}-board-${reviewCase.width}x${reviewCase.height}.png`), fullPage: false });

    await page.locator('[data-command-view="forces"]').click();
    const forcesDrawer = page.locator('.forces-view');
    await forcesDrawer.waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.bg12e-board-zone > .bg12k-map-underlay').waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForTimeout(350);
    const forces = await readAideState(page, '.forces-view');
    assertCommonDrawerState(reviewCase, forces, 'Forces');
    assertUnderlay(reviewCase, forces, 'Forces');
    assert(forces.settingsToggleDisplay === 'none', `${reviewCase.id} Settings launcher remained visible beside Forces`);
    assert(forces.drawer.x <= (reviewCase.id === 'compact' ? 18 : 70),
      `${reviewCase.id} Forces drawer is not anchored to the left: ${JSON.stringify(forces.drawer)}`);
    await page.screenshot({ path: path.join(outputDir, `${reviewCase.id}-forces-${reviewCase.width}x${reviewCase.height}.png`), fullPage: false });

    await page.keyboard.press('Escape');
    await page.locator('.command-stage-map').waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('.bg12e-board-zone > .bg12k-map-underlay').length === 0, null, { timeout: 10000 });

    await page.locator('[data-command-view="campaign"]').click();
    const campaignDrawer = page.locator('.campaign-view');
    await campaignDrawer.waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.bg12e-board-zone > .bg12k-map-underlay').waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForTimeout(350);
    const campaign = await readAideState(page, '.campaign-view');
    assertCommonDrawerState(reviewCase, campaign, 'Rules & Save');
    assertUnderlay(reviewCase, campaign, 'Rules & Save');
    assert(campaign.settingsToggleDisplay === 'none', `${reviewCase.id} Settings launcher remained visible beside Rules & Save`);
    const campaignRightGap = reviewCase.width - campaign.drawer.right;
    assert(campaignRightGap <= (reviewCase.id === 'compact' ? 18 : 470),
      `${reviewCase.id} Rules & Save drawer is not anchored to the right: ${JSON.stringify(campaign.drawer)}`);
    await page.screenshot({ path: path.join(outputDir, `${reviewCase.id}-rules-save-${reviewCase.width}x${reviewCase.height}.png`), fullPage: false });

    await page.keyboard.press('Escape');
    await page.locator('.command-stage-map').waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('.bg12e-board-zone > .bg12k-map-underlay').length === 0, null, { timeout: 10000 });

    const settingsToggle = page.getByRole('button', { name: 'Open game settings', exact: true });
    await settingsToggle.waitFor({ state: 'visible', timeout: 10000 });
    await settingsToggle.click();
    const settingsPanel = page.locator('.global-settings-panel');
    await settingsPanel.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(250);
    const settings = await readAideState(page, '.global-settings-panel');
    assertCommonDrawerState(reviewCase, settings, 'Settings');
    assert(settings.underlayCount === 0, `${reviewCase.id} Settings created an unnecessary board snapshot`);
    assert(settings.navigationPointerEvents === 'none', `${reviewCase.id} command navigation remained active behind Settings`);
    assert(settings.backdropPointerEvents === 'none', `${reviewCase.id} Settings backdrop still blocks the visible board`);
    assert(settings.drawer.pointerEvents === 'auto', `${reviewCase.id} Settings controls are not interactive`);
    const settingsRightGap = reviewCase.width - settings.drawer.right;
    assert(settingsRightGap <= (reviewCase.id === 'compact' ? 18 : 470),
      `${reviewCase.id} Settings drawer is not anchored to the right: ${JSON.stringify(settings.drawer)}`);
    assert(await settingsPanel.getByRole('button', { name: 'Close settings', exact: true }).isVisible(),
      `${reviewCase.id} Settings close control is not visible`);
    await page.screenshot({ path: path.join(outputDir, `${reviewCase.id}-settings-${reviewCase.width}x${reviewCase.height}.png`), fullPage: false });

    await page.keyboard.press('Escape');
    await settingsPanel.waitFor({ state: 'detached', timeout: 10000 });
    const finalState = await readAideState(page, '.command-map-workspace');
    assert(finalState.singleAideCount === 0, `${reviewCase.id} secondary aide remained after Escape close`);
    assert(finalState.underlayCount === 0, `${reviewCase.id} stale board underlay remained after all aides closed`);
    assert(errors.length === 0, `${reviewCase.id} browser errors: ${JSON.stringify(errors)}`);

    evidence.cases.push({
      ...reviewCase,
      baseline,
      forces,
      campaign: { ...campaign, rightGap: campaignRightGap },
      settings: { ...settings, rightGap: settingsRightGap },
      finalState,
      browserErrors: errors,
      screenshots: {
        board: `${reviewCase.id}-board-${reviewCase.width}x${reviewCase.height}.png`,
        forces: `${reviewCase.id}-forces-${reviewCase.width}x${reviewCase.height}.png`,
        campaign: `${reviewCase.id}-rules-save-${reviewCase.width}x${reviewCase.height}.png`,
        settings: `${reviewCase.id}-settings-${reviewCase.width}x${reviewCase.height}.png`
      }
    });
  } finally {
    await context.close();
  }
}

await browser.close();
assert(evidence.cases.length === cases.length, 'BG12K evidence did not complete all viewports');
fs.writeFileSync(path.join(outputDir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
