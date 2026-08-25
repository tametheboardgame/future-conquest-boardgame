import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.R3_WP65_ORIGIN ?? 'http://127.0.0.1:4173';
const outputDir = process.env.R3_WP65_ARTIFACTS ?? 'artifacts/r3-wp6-5';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 829 }, reducedMotion: 'reduce' });
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function intersects(a, b, tolerance = 0) {
  if (!a || !b) return false;
  return a.left < b.right - tolerance && a.right > b.left + tolerance && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
}

function contains(outer, inner, tolerance = 0) {
  if (!outer || !inner) return false;
  return inner.left >= outer.left - tolerance
    && inner.right <= outer.right + tolerance
    && inner.top >= outer.top - tolerance
    && inner.bottom <= outer.bottom + tolerance;
}

async function shellEvidence() {
  return page.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        left: box.left, top: box.top, right: box.right, bottom: box.bottom,
        width: box.width, height: box.height, display: style.display,
        visibility: style.visibility, overflowY: style.overflowY, position: style.position
      };
    };
    const visible = node => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const navRects = [...document.querySelectorAll('.command-nav-items button')].map(node => {
      const box = node.getBoundingClientRect();
      return { height: box.height, width: box.width, top: box.top, bottom: box.bottom };
    });
    const strongs = [...document.querySelectorAll('.command-metrics > div:not(.escalation) > strong, .command-metrics > button > strong')].map(node => {
      const box = node.getBoundingClientRect();
      return { text: node.textContent?.trim() ?? '', top: box.top, bottom: box.bottom, height: box.height };
    });
    const attributionNodes = [...document.querySelectorAll('.r3-terrain-prototype-attribution, .maplibregl-ctrl-attrib')];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      topbar: rect('.command-topbar'),
      settings: rect('.global-settings-toggle'),
      metrics: rect('.command-metrics'),
      networkMetric: rect('.network-supply-metric'),
      navigation: rect('.command-navigation'),
      navRects,
      metricStrongs: strongs,
      mapPanel: rect('.map-panel'),
      mapHeading: rect('.map-heading'),
      terrainToolbar: rect('.r3-terrain-prototype-toolbar'),
      terrainToolbarTitle: rect('.r3-terrain-prototype-toolbar > span'),
      mapContext: rect('.map-context-panel'),
      sidebarHeader: rect('.map-context-panel .quick-command-heading'),
      sidebarToggle: rect('.map-ux-sidebar-toggle'),
      visibleAttributions: attributionNodes.filter(visible).length,
      attributionGeometry: attributionNodes.filter(visible).map(node => {
        const box = node.getBoundingClientRect();
        return { className: node.className, left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      }),
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth
    };
  });
}

function assertStableShell(evidence, { expectTerrain = true } = {}) {
  assert(evidence.topbar && evidence.settings && evidence.metrics && evidence.navigation && evidence.mapPanel, `missing command-shell geometry: ${JSON.stringify(evidence)}`);
  assert(evidence.settings.top >= evidence.topbar.top - 3 && evidence.settings.bottom <= evidence.topbar.bottom + 3,
    `Settings is not visually anchored inside the command header: ${JSON.stringify({ settings: evidence.settings, topbar: evidence.topbar })}`);
  assert(!intersects(evidence.settings, evidence.metrics, 1), 'Settings overlaps telemetry');
  assert(evidence.horizontalOverflow <= 2, `horizontal overflow detected: ${evidence.horizontalOverflow}px`);

  const heights = evidence.navRects.map(item => item.height);
  assert(heights.length === 8, `expected eight persistent command items, got ${heights.length}`);
  assert(Math.max(...heights) - Math.min(...heights) <= 1.5, `navigation tiles have inconsistent heights: ${JSON.stringify(heights)}`);
  if (evidence.viewport.width > 900) {
    assert(Math.max(...heights) <= 58, `desktop navigation tiles are stretching vertically: ${Math.max(...heights)}px`);

    const metricTops = evidence.metricStrongs.map(item => item.top);
    if (metricTops.length > 1) assert(Math.max(...metricTops) - Math.min(...metricTops) <= 3.5, `desktop telemetry value baselines are misaligned: ${JSON.stringify(evidence.metricStrongs)}`);
  }

  if (expectTerrain && evidence.terrainToolbar) {
    assert(evidence.terrainToolbar.height <= 40, `ready terrain toolbar is still a large band: ${evidence.terrainToolbar.height}px`);
    assert(evidence.terrainToolbarTitle?.display === 'none', `redundant terrain title remains visible: ${JSON.stringify(evidence.terrainToolbarTitle)}`);
    assert(!intersects(evidence.mapHeading, evidence.terrainToolbar, 2), `legend and terrain controls overlap: ${JSON.stringify({ heading: evidence.mapHeading, toolbar: evidence.terrainToolbar })}`);
    assert(evidence.visibleAttributions === 1, `expected exactly one visible terrain attribution, got ${evidence.visibleAttributions}`);
  }

  if (evidence.mapContext && evidence.sidebarToggle) {
    assert(contains(evidence.mapContext, evidence.sidebarToggle, 2.5),
      `sidebar toggle escapes the context panel: ${JSON.stringify({ toggle: evidence.sidebarToggle, panel: evidence.mapContext })}`);
    assert(evidence.sidebarHeader && contains(evidence.sidebarHeader, evidence.sidebarToggle, 2.5),
      `sidebar toggle is not contained by the panel header: ${JSON.stringify({ toggle: evidence.sidebarToggle, header: evidence.sidebarHeader })}`);
  }
}

async function capture(name, width, height, options = {}) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(280);
  const evidence = await shellEvidence();
  assertStableShell(evidence, options);
  await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: false });
  return evidence;
}

async function specialistSweep() {
  const results = {};
  for (const view of ['forces', 'operations', 'territories', 'engineering', 'logistics', 'intelligence', 'campaign']) {
    await page.locator(`[data-command-view="${view}"]`).click();
    await page.waitForTimeout(120);
    results[view] = await page.evaluate(() => {
      const stage = document.querySelector('.command-stage');
      const viewNode = document.querySelector('.command-view');
      const stageBox = stage?.getBoundingClientRect();
      const viewBox = viewNode?.getBoundingClientRect();
      return {
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        stage: stageBox ? { left: stageBox.left, right: stageBox.right, width: stageBox.width } : null,
        view: viewBox ? { left: viewBox.left, right: viewBox.right, width: viewBox.width, scrollWidth: viewNode.scrollWidth, clientWidth: viewNode.clientWidth } : null
      };
    });
    assert(results[view].horizontalOverflow <= 2, `${view} introduces horizontal page overflow`);
    if (results[view].view) assert(results[view].view.scrollWidth <= results[view].view.clientWidth + 3, `${view} command view has internal horizontal overflow: ${JSON.stringify(results[view].view)}`);
  }
  return results;
}

try {
  await page.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
  });

  await page.goto(`${origin}/?terrain=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
  await page.locator('.command-workspace').waitFor({ state: 'visible', timeout: 45000 });
  await page.locator('.r3-terrain-prototype').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(() => ['ready', 'warning'].includes(document.querySelector('.r3-terrain-prototype')?.getAttribute('data-status') ?? ''), null, { timeout: 45000 });
  await page.waitForTimeout(900);

  const evidence = { schemaVersion: 2, head: process.env.GITHUB_SHA ?? null, captures: {}, shell: {}, specialistSweep: {}, tutorial: {} };

  evidence.shell.large = await capture('command-map-1900x829', 1900, 829);
  evidence.captures.large = 'command-map-1900x829.png';

  evidence.shell.desktop = await capture('command-map-1366x768', 1366, 768);
  evidence.captures.desktop = 'command-map-1366x768.png';

  const beforeCollapse = evidence.shell.desktop;
  await page.locator('[data-map-sidebar-toggle]').click();
  await page.waitForTimeout(260);
  const collapsed = await shellEvidence();
  assertStableShell(collapsed);
  evidence.shell.collapsed = collapsed;
  await page.locator('[data-map-sidebar-toggle]').click();
  await page.waitForTimeout(240);
  assert(beforeCollapse.mapPanel.width <= (await shellEvidence()).mapPanel.width + 3, 'map panel did not restore after sidebar expansion');

  evidence.specialistSweep = await specialistSweep();

  await page.getByRole('button', { name: 'Restart tutorial', exact: true }).click();
  await page.evaluate(() => document.querySelector('[data-command-view="map"]')?.click());
  await page.locator('.tutorial-overlay').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(180);

  evidence.tutorial.desktop = await page.evaluate(() => {
    const overlay = document.querySelector('.tutorial-overlay');
    const box = overlay?.getBoundingClientRect();
    const style = overlay ? getComputedStyle(overlay) : null;
    const forward = [...document.querySelectorAll('.tutorial-actions button')].filter(button => button.textContent?.trim() === 'Forward').filter(button => getComputedStyle(button).display !== 'none');
    return box && overlay && style ? {
      top: box.top, bottom: box.bottom, height: box.height,
      clientHeight: overlay.clientHeight, scrollHeight: overlay.scrollHeight,
      overflowY: style.overflowY, visibleForwardButtons: forward.length
    } : null;
  });
  assert(evidence.tutorial.desktop, 'desktop tutorial overlay missing');
  assert(evidence.tutorial.desktop.visibleForwardButtons === 0, 'tutorial still presents a Forward button');
  assert(evidence.tutorial.desktop.bottom <= 768 + 2 && evidence.tutorial.desktop.top >= -2, `desktop tutorial escapes viewport: ${JSON.stringify(evidence.tutorial.desktop)}`);
  assert(evidence.tutorial.desktop.scrollHeight <= evidence.tutorial.desktop.clientHeight + 2, `normal desktop tutorial has unnecessary internal scrolling: ${JSON.stringify(evidence.tutorial.desktop)}`);
  await page.screenshot({ path: `${outputDir}/tutorial-1366x768.png`, fullPage: false });
  evidence.captures.tutorialDesktop = 'tutorial-1366x768.png';

  await page.setViewportSize({ width: 640, height: 900 });
  await page.waitForTimeout(280);
  evidence.tutorial.compact = await page.evaluate(() => {
    const overlay = document.querySelector('.tutorial-overlay');
    const box = overlay?.getBoundingClientRect();
    const forward = [...document.querySelectorAll('.tutorial-actions button')].filter(button => button.textContent?.trim() === 'Forward').filter(button => getComputedStyle(button).display !== 'none');
    return box && overlay ? {
      top: box.top, bottom: box.bottom, height: box.height,
      clientHeight: overlay.clientHeight, scrollHeight: overlay.scrollHeight,
      visibleForwardButtons: forward.length,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth
    } : null;
  });
  assert(evidence.tutorial.compact, '640x900 tutorial overlay missing');
  assert(evidence.tutorial.compact.visibleForwardButtons === 0, 'compact tutorial presents a Forward button');
  assert(evidence.tutorial.compact.top >= -2 && evidence.tutorial.compact.bottom <= 900 + 2, `compact tutorial escapes viewport: ${JSON.stringify(evidence.tutorial.compact)}`);
  assert(evidence.tutorial.compact.horizontalOverflow <= 2, `compact tutorial introduces horizontal overflow: ${evidence.tutorial.compact.horizontalOverflow}px`);
  await page.screenshot({ path: `${outputDir}/tutorial-640x900.png`, fullPage: false });
  evidence.captures.tutorialCompact = 'tutorial-640x900.png';

  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).evaluate(element => element.click());
  await page.waitForTimeout(100);
  evidence.shell.compact = await capture('command-map-640x900', 640, 900, { expectTerrain: false });
  evidence.captures.compact = 'command-map-640x900.png';

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  let settingsReachedByKeyboard = false;
  for (let index = 0; index < 160; index += 1) {
    await page.keyboard.press('Tab');
    settingsReachedByKeyboard = await page.locator('.global-settings-toggle').evaluate(node => document.activeElement === node);
    if (settingsReachedByKeyboard) break;
  }
  const focusEvidence = await page.evaluate(() => {
    const node = document.querySelector('.global-settings-toggle');
    const style = node ? getComputedStyle(node) : null;
    return { active: document.activeElement === node, outlineStyle: style?.outlineStyle ?? '', outlineWidth: style?.outlineWidth ?? '' };
  });
  assert(settingsReachedByKeyboard && focusEvidence.active, 'Settings control is not reachable by keyboard Tab navigation');
  assert(focusEvidence.outlineStyle !== 'none' && focusEvidence.outlineWidth !== '0px', `Settings keyboard focus indicator missing: ${JSON.stringify(focusEvidence)}`);
  evidence.focus = focusEvidence;

  fs.writeFileSync(`${outputDir}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);

  const relevantErrors = errors.filter(error => !/favicon|ERR_ABORTED|Failed to load resource.*404/i.test(error));
  assert(relevantErrors.length === 0, `browser errors detected: ${JSON.stringify(relevantErrors)}`);
  console.log('R3-WP6.5 interface polish browser probe passed.');
} finally {
  await browser.close();
}
