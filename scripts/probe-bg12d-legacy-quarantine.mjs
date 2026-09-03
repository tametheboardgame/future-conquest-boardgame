import { chromium } from 'playwright';

const origin = process.env.BG12D_ORIGIN ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function startCampaign(page, query) {
  await page.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
  });
  await page.goto(`${origin}/${query}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
  await page.locator('.command-workspace').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('.r3-terrain-prototype').waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForFunction(() => ['ready', 'warning'].includes(document.querySelector('.r3-terrain-prototype')?.getAttribute('data-status') ?? ''), null, { timeout: 45_000 });
}

function visible(node) {
  if (!(node instanceof Element)) return false;
  const style = getComputedStyle(node);
  const box = node.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
}

try {
  const normal = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await startCampaign(normal, '?terrain=1');

  const normalEvidence = await normal.evaluate(() => {
    const isVisible = node => {
      if (!(node instanceof Element)) return false;
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const legacyViews = ['operations', 'territories', 'engineering', 'logistics', 'intelligence'];
    return {
      mode: document.documentElement.dataset.bg12dPresentation,
      boardClass: document.documentElement.classList.contains('bg12d-board-ui'),
      legacyGatewayVisible: isVisible(document.querySelector('.command-nav-legacy')),
      legacyViewVisibility: Object.fromEntries(legacyViews.map(view => [view, isVisible(document.querySelector(`[data-command-view="${view}"]`))])),
      topbarVisible: isVisible(document.querySelector('.command-topbar')),
      mapHeadingVisible: isVisible(document.querySelector('.map-heading')),
      mapContextVisible: isVisible(document.querySelector('.map-context-panel')),
      legacyAlertCount: [...document.querySelectorAll('.operational-alert-strip, .enemy-action-alert, .adviser-alert-strip, .combat-report-alert')].filter(isVisible).length,
      stage: rect('.command-stage-map'),
      workspace: rect('.command-map-workspace'),
      mapPanel: rect('.map-panel'),
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth
    };
  });

  assert(normalEvidence.mode === 'board-game' && normalEvidence.boardClass, `normal route did not install board-game mode: ${JSON.stringify(normalEvidence)}`);
  assert(!normalEvidence.legacyGatewayVisible, 'legacy More gateway is visible in normal play');
  assert(Object.values(normalEvidence.legacyViewVisibility).every(value => value === false), `legacy command route remained visible: ${JSON.stringify(normalEvidence.legacyViewVisibility)}`);
  assert(!normalEvidence.topbarVisible, 'legacy operational topbar is visible in normal play');
  assert(!normalEvidence.mapHeadingVisible, 'legacy permanent map heading/legend is visible in normal play');
  assert(!normalEvidence.mapContextVisible, 'legacy operational map context panel is visible in normal play');
  assert(normalEvidence.legacyAlertCount === 0, `legacy simulation alerts remain visible: ${normalEvidence.legacyAlertCount}`);
  assert((normalEvidence.horizontalOverflow ?? 999) <= 2, `normal board route has horizontal overflow: ${normalEvidence.horizontalOverflow}`);
  assert(normalEvidence.mapPanel && normalEvidence.workspace && normalEvidence.mapPanel.width >= normalEvidence.workspace.width - 4,
    `map did not reclaim the quarantined sidebar width: ${JSON.stringify({ map: normalEvidence.mapPanel, workspace: normalEvidence.workspace })}`);

  const diagnostics = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await startCampaign(diagnostics, '?terrain=1&legacy-ui=1');
  const diagnosticEvidence = await diagnostics.evaluate(() => {
    const isVisible = node => {
      if (!(node instanceof Element)) return false;
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    return {
      mode: document.documentElement.dataset.bg12dPresentation,
      legacyClass: document.documentElement.classList.contains('bg12d-legacy-ui'),
      legacyGatewayVisible: isVisible(document.querySelector('.command-nav-legacy')),
      operationsVisible: isVisible(document.querySelector('[data-command-view="operations"]')),
      topbarVisible: isVisible(document.querySelector('.command-topbar')),
      mapContextVisible: isVisible(document.querySelector('.map-context-panel'))
    };
  });

  assert(diagnosticEvidence.mode === 'legacy-diagnostics' && diagnosticEvidence.legacyClass,
    `diagnostics route did not install legacy mode: ${JSON.stringify(diagnosticEvidence)}`);
  assert(diagnosticEvidence.legacyGatewayVisible, 'diagnostics route lost the legacy workspace gateway');
  assert(diagnosticEvidence.operationsVisible, 'diagnostics route lost the legacy operations workspace route');
  assert(diagnosticEvidence.topbarVisible, 'diagnostics route did not restore the operational topbar');
  assert(diagnosticEvidence.mapContextVisible, 'diagnostics route did not restore the operational map context panel');

  await diagnostics.locator('.command-nav-legacy summary').click();
  const engineering = diagnostics.locator('[data-command-view="engineering"]');
  await engineering.waitFor({ state: 'visible', timeout: 5_000 });

  console.log(JSON.stringify({ normal: normalEvidence, diagnostics: diagnosticEvidence }, null, 2));
} finally {
  await browser.close();
}
