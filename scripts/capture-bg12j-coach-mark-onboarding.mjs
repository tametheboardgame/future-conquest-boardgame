import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BG12J_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDir = process.env.BG12J_OUTPUT_DIR ?? 'artifacts/bg12j';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function knownTerrainWarning(text = '') {
  return /Cannot read properties of undefined \(reading ['"]id['"]\)/i.test(text)
    && /(R3 terrain source warning|TerrainMapPrototype|setFeatureState|initializeTileState|_tileLoaded|_loadTile)/i.test(text);
}

async function waitForPortalBeforeTutorial(page, timeout = 60000) {
  const handle = await page.waitForFunction(() => {
    const portal = document.querySelector('.r3-portal-arrival');
    const shell = document.querySelector('.startup-game-shell');
    const tutorialCount = document.querySelectorAll('.tutorial-guide').length;
    const formationsWithheld = document.documentElement.dataset.r3WithholdFormations === 'true';
    const arrivalClass = shell?.classList.contains('portal-arrival-active') ?? false;
    if (!portal || tutorialCount !== 0 || !formationsWithheld || !arrivalClass) return false;
    return {
      portalPresent: true,
      portalPhase: portal.getAttribute('data-phase'),
      tutorialCount,
      formationsWithheld,
      arrivalClass
    };
  }, null, { timeout, polling: 'raf' });
  return handle.jsonValue();
}

const cases = [
  { id: 'wide', width: 1900, height: 829, maxWidth: 320, maxHeight: 310 },
  { id: 'laptop', width: 1366, height: 768, maxWidth: 320, maxHeight: 310 },
  { id: 'compact', width: 640, height: 900, maxWidth: 308, maxHeight: 280 }
];

const evidence = {
  schemaVersion: 1,
  head: process.env.BG12J_REF ?? process.env.GITHUB_SHA ?? null,
  cases: []
};

for (const reviewCase of cases) {
  const context = await browser.newContext({
    viewport: { width: reviewCase.width, height: reviewCase.height },
    reducedMotion: 'no-preference'
  });
  await context.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.removeItem('future-conquest-tutorial-seen-v1');
    localStorage.removeItem('future-conquest-tutorial-replay-v1');
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
    await page.locator('.startup-game-shell').waitFor({ state: 'visible', timeout: 20000 });

    const portalBeforeTutorial = await waitForPortalBeforeTutorial(page);
    const arrival = page.locator('.r3-portal-arrival');
    await arrival.waitFor({ state: 'detached', timeout: 60000 });

    const guide = page.locator('.tutorial-guide').first();
    const coach = page.locator('.tutorial-overlay').first();
    const spotlight = page.locator('.tutorial-spotlight').first();
    await guide.waitFor({ state: 'attached', timeout: 15000 });
    await coach.waitFor({ state: 'visible', timeout: 15000 });
    await spotlight.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);

    const afterArrival = await page.evaluate(() => ({
      portalCount: document.querySelectorAll('.r3-portal-arrival').length,
      tutorialCount: document.querySelectorAll('.tutorial-guide').length,
      arrivalClass: document.querySelector('.startup-game-shell')?.classList.contains('portal-arrival-active') ?? false,
      formationsWithheld: document.documentElement.dataset.r3WithholdFormations === 'true'
    }));
    assert(afterArrival.portalCount === 0, `${reviewCase.id} portal remained mounted when coach mark began`);
    assert(afterArrival.tutorialCount === 1, `${reviewCase.id} coach mark did not begin after portal completion`);
    assert(!afterArrival.arrivalClass, `${reviewCase.id} portal presentation class remained active`);
    assert(!afterArrival.formationsWithheld, `${reviewCase.id} formations remained withheld after portal completion`);

    const coachBox = await coach.boundingBox();
    const spotlightBox = await spotlight.boundingBox();
    assert(coachBox, `${reviewCase.id} coach mark has no measurable box`);
    assert(spotlightBox, `${reviewCase.id} spotlight has no measurable box`);
    assert(coachBox.width <= reviewCase.maxWidth,
      `${reviewCase.id} coach mark width exceeds budget: ${JSON.stringify(coachBox)}`);
    assert(coachBox.height <= reviewCase.maxHeight,
      `${reviewCase.id} coach mark height exceeds budget: ${JSON.stringify(coachBox)}`);

    const styles = await page.evaluate(() => {
      const guide = document.querySelector('.tutorial-guide');
      const coach = document.querySelector('.tutorial-overlay');
      const spotlight = document.querySelector('.tutorial-spotlight');
      if (!(guide instanceof HTMLElement) || !(coach instanceof HTMLElement) || !(spotlight instanceof HTMLElement)) return null;
      const guideStyle = getComputedStyle(guide);
      const coachStyle = getComputedStyle(coach);
      const spotlightStyle = getComputedStyle(spotlight);
      return {
        guidePointerEvents: guideStyle.pointerEvents,
        coachPointerEvents: coachStyle.pointerEvents,
        spotlightPointerEvents: spotlightStyle.pointerEvents,
        spotlightBoxShadow: spotlightStyle.boxShadow,
        coachOverflowY: coachStyle.overflowY,
        placement: coach.dataset.placement ?? null,
        mode: coach.dataset.mode ?? null,
        ariaLive: guide.getAttribute('aria-live'),
        ariaLabel: guide.getAttribute('aria-label')
      };
    });
    assert(styles, `${reviewCase.id} could not read coach styles`);
    assert(styles.guidePointerEvents === 'none', `${reviewCase.id} tutorial guide blocks board input`);
    assert(styles.coachPointerEvents === 'auto', `${reviewCase.id} coach controls are not interactive`);
    assert(styles.spotlightPointerEvents === 'none', `${reviewCase.id} spotlight blocks target input`);
    assert(!styles.spotlightBoxShadow.includes('9999px'),
      `${reviewCase.id} tutorial still applies a full-screen spotlight scrim: ${styles.spotlightBoxShadow}`);
    assert(styles.ariaLive === 'polite' && styles.ariaLabel === 'Guided campaign tutorial',
      `${reviewCase.id} tutorial accessibility semantics drifted: ${JSON.stringify(styles)}`);

    const progress = (await coach.locator('.tutorial-progress').innerText()).replace(/\s+/g, ' ').trim();
    assert(progress.includes('GUIDED CAMPAIGN'), `${reviewCase.id} coach progress label missing`);
    assert(await coach.getByRole('button', { name: 'Skip tutorial', exact: true }).isVisible(),
      `${reviewCase.id} skip control missing`);

    const mapCanvas = page.locator('.maplibregl-canvas').first();
    await mapCanvas.waitFor({ state: 'visible', timeout: 15000 });
    const mapBox = await mapCanvas.boundingBox();
    assert(mapBox, `${reviewCase.id} map canvas has no measurable box`);
    assert(mapBox.width >= reviewCase.width * (reviewCase.id === 'compact' ? 0.90 : 0.65),
      `${reviewCase.id} map no longer remains visually dominant: ${JSON.stringify(mapBox)}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 2, `${reviewCase.id} horizontal overflow exceeded 2px: ${overflow}`);

    const viewportArea = reviewCase.width * reviewCase.height;
    const coachArea = coachBox.width * coachBox.height;
    assert(coachArea / viewportArea < (reviewCase.id === 'compact' ? 0.16 : 0.10),
      `${reviewCase.id} coach mark consumes too much viewport area: ${coachArea / viewportArea}`);
    assert(errors.length === 0, `${reviewCase.id} browser errors: ${JSON.stringify(errors)}`);

    const filename = `${reviewCase.id}-${reviewCase.width}x${reviewCase.height}.png`;
    await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });

    evidence.cases.push({
      ...reviewCase,
      portalBeforeTutorial,
      afterArrival,
      coachBox,
      spotlightBox,
      styles,
      progress,
      mapBox,
      overflow,
      coachAreaRatio: coachArea / viewportArea,
      browserErrors: errors,
      screenshot: filename
    });
  } finally {
    await context.close();
  }
}

await browser.close();
assert(evidence.cases.length === cases.length, 'BG12J evidence did not complete');
fs.writeFileSync(path.join(outputDir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
