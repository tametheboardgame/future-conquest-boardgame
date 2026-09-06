import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.R3_WP2I_ORIGIN ?? 'http://127.0.0.1:4173';
const outputDir = process.env.R3_WP2I_ARTIFACTS ?? 'artifacts/r3-wp2i-selection';
const viewport = { width: 1792, height: 858 };
const manualSaveKey = 'future-conquest-slice-v0.14';
const manualSaveMetadataKey = `${manualSaveKey}-metadata`;
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

// BG12H retired the old priority-order panel. WP2I now waits for the actual
// territory-selection state, while BG12H's contextual gate owns attack readiness.
const frankfurtSelected = () => document.querySelector('.r3-terrain-territory-label.selected')?.getAttribute('data-territory-id') === 'DE-03';

async function findAndSaveNaturalDusseldorfCampaign() {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on('console', message => console.log(`[campaign-setup console ${message.type()}] ${message.text()}`));
  page.on('pageerror', error => console.log(`[campaign-setup pageerror] ${error.stack ?? error.message}`));
  await page.addInitScript(() => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
    window.__wp2iMapIdentities = new WeakMap();
    window.__wp2iNextMapIdentity = 1;
  });
  let campaignAttempts = 1;
  let savedStorage;
  try {
    await page.goto(`${origin}/?terrain=1`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
    await page.locator('.startup-game-shell').waitFor({ state: 'visible' });
    // BEGIN CAMPAIGN intentionally lands on Map. This setup needs the Campaign
    // file controls, so explicitly open Campaign before looking for Manual Save.
    await page.locator('[data-command-view="map"][aria-current="page"]').waitFor({ state: 'visible' });
    await page.locator('[data-command-view="campaign"]').click();
    await page.locator('[data-command-view="campaign"][aria-current="page"]').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Manual Save', exact: true }).waitFor({ state: 'visible' });

    // Generate one campaign through the real new-campaign path. Once the naturally
    // random Düsseldorf start is found, use the product's Manual Save path so each
    // surface can replay the identical campaign without repeating this search.
    for (;;) {
      await page.getByRole('button', { name: 'Manual Save', exact: true }).click();
      await page.waitForFunction(key => Boolean(localStorage.getItem(key)), manualSaveKey);
      savedStorage = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), [manualSaveKey, manualSaveMetadataKey]);
      const savedState = JSON.parse(savedStorage[manualSaveKey]);
      if (savedState.portalTerritory === 'DE-02') break;
      if (campaignAttempts >= 200) throw new Error('No natural Day-1 Düsseldorf portal after 200 campaigns.');
      await page.getByRole('button', { name: 'New campaign', exact: true }).click();
      // startCampaign() intentionally returns to Map. Reopen Campaign before the
      // next iteration so its Manual Save control is rendered and actionable.
      await page.locator('[data-command-view="map"][aria-current="page"]').waitFor({ state: 'visible' });
      await page.locator('[data-command-view="campaign"]').click();
      await page.locator('[data-command-view="campaign"][aria-current="page"]').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Manual Save', exact: true }).waitFor({ state: 'visible' });
      campaignAttempts += 1;
    }
    if (!savedStorage[manualSaveKey]) throw new Error('Manual Save UI did not populate the current save slot.');
    return { savedStorage, campaignAttempts };
  } catch (error) {
    const diagnostic = {
      phase: 'natural-dusseldorf-search',
      campaignAttempts,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      url: page.url(),
      activeCommandView: await page.locator('[data-command-view][aria-current="page"]').getAttribute('data-command-view').catch(() => null),
      manualSaveVisible: await page.getByRole('button', { name: 'Manual Save', exact: true }).isVisible().catch(() => false),
      newCampaignVisible: await page.getByRole('button', { name: 'New campaign', exact: true }).isVisible().catch(() => false)
    };
    fs.writeFileSync(`${outputDir}/setup-diagnostic.json`, `${JSON.stringify(diagnostic, null, 2)}\n`);
    await page.screenshot({ path: `${outputDir}/setup-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function openSavedDusseldorfCampaign(scenario, savedStorage) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on('console', message => console.log(`[${scenario} console ${message.type()}] ${message.text()}`));
  page.on('pageerror', error => console.log(`[${scenario} pageerror] ${error.stack ?? error.message}`));
  await page.addInitScript(({ storage, saveKey, metadataKey }) => {
    localStorage.setItem('future-conquest:intro-seen:v3', 'true');
    localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
    localStorage.setItem(saveKey, storage[saveKey]);
    if (storage[metadataKey]) localStorage.setItem(metadataKey, storage[metadataKey]);
    window.__wp2iMapIdentities = new WeakMap();
    window.__wp2iNextMapIdentity = 1;
  }, { storage: savedStorage, saveKey: manualSaveKey, metadataKey: manualSaveMetadataKey });
  try {
    await page.goto(`${origin}/?terrain=1`, { waitUntil: 'domcontentloaded' });
    // Exercise the canonical saved-game launcher transaction. continueCampaign()
    // briefly opens Campaign and invokes Load Manual Save; a successful App.load()
    // finishes on Map, which is the stable completed-transaction state. Campaign
    // below refers to the map's initial camera LOD, not the Campaign command view.
    await page.getByRole('button', { name: 'CONTINUE CAMPAIGN' }).click();
    await page.locator('.startup-game-shell').waitFor({ state: 'visible' });
    await page.locator('[data-command-view="map"][aria-current="page"]').waitFor({ state: 'visible' });
    const host = page.locator('.r3-terrain-prototype');
    await host.waitFor({ state: 'visible', timeout: 45_000 });
    await page.waitForFunction(() => document.querySelector('.r3-terrain-prototype')?.getAttribute('data-status') === 'ready');
    await page.locator('.r3-terrain-portal-marker[data-territory-id="DE-02"]').waitFor({ state: 'attached' });
    // Stay on Map: selecting the Campaign command view unmounts the terrain host.
    // The loaded save initializes this map from the Campaign camera preset.
    await page.waitForFunction(() => {
      const host = document.querySelector('.r3-terrain-prototype');
      return host?.getAttribute('data-overlay-lod') === 'campaign'
        && host?.getAttribute('data-terrain-relief') === 'physical';
    });
    return { context, page };
  } catch (error) {
    const scenarioDir = `${outputDir}/${scenario}`;
    fs.mkdirSync(scenarioDir, { recursive: true });
    const diagnostic = {
      scenario,
      phase: 'saved-campaign-setup',
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      url: page.url(),
      launcherContinueVisible: await page.getByRole('button', { name: 'CONTINUE CAMPAIGN' }).isVisible().catch(() => false),
      activeCommandView: await page.locator('[data-command-view][aria-current="page"]').getAttribute('data-command-view').catch(() => null),
      terrainStatus: await page.locator('.r3-terrain-prototype').getAttribute('data-status').catch(() => null),
      dusseldorfPortalPresent: await page.locator('.r3-terrain-portal-marker[data-territory-id="DE-02"]').count().catch(() => 0),
      overlayLod: await page.locator('.r3-terrain-prototype').getAttribute('data-overlay-lod').catch(() => null),
      terrainRelief: await page.locator('.r3-terrain-prototype').getAttribute('data-terrain-relief').catch(() => null),
      mapCamera: await page.evaluate(() => {
        const map = window.__r3TerrainMap;
        if (!map) return null;
        const center = map.getCenter();
        return {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing()
        };
      }).catch(() => null)
    };
    fs.writeFileSync(`${scenarioDir}/setup-diagnostic.json`, `${JSON.stringify(diagnostic, null, 2)}\n`);
    await page.screenshot({ path: `${scenarioDir}/setup-failure.png`, fullPage: true }).catch(() => {});
    await context.close();
    throw error;
  }
}

async function installRecorder(page) {
  await page.evaluate(() => {
    const map = window.__r3TerrainMap;
    if (!map) throw new Error('MapLibre diagnostic API unavailable');
    window.__wp2iOriginalMap = map;
    window.__wp2iMapTrace = [];
    const record = (kind, detail = {}) => window.__wp2iMapTrace.push({ kind, at: performance.now(), ...detail });
    for (const method of ['easeTo', 'jumpTo', 'fitBounds', 'setCenter', 'setZoom', 'setPadding', 'resize']) {
      const original = map[method];
      if (typeof original !== 'function') continue;
      map[method] = function (...args) {
        record('call', {
          method,
          args,
          stack: new Error().stack?.split('\n').slice(1, 6).join('\n') ?? null
        });
        return original.apply(this, args);
      };
    }
    for (const event of ['movestart', 'moveend', 'zoomstart', 'zoomend']) {
      map.on(event, () => record('event', { event }));
    }
  });
}

async function snapshot(page, label) {
  return page.evaluate(label => {
    const map = window.__r3TerrainMap;
    const host = document.querySelector('.r3-terrain-prototype');
    const container = document.querySelector('.r3-terrain-prototype-canvas');
    const canvas = container?.querySelector('canvas');
    if (!map || !(canvas instanceof HTMLCanvasElement)) throw new Error('terrain diagnostic API unavailable');
    const dimensions = element => {
      if (!(element instanceof Element)) return null;
      const rect = element.getBoundingClientRect();
      return { cssWidth: rect.width, cssHeight: rect.height, clientWidth: element.clientWidth, clientHeight: element.clientHeight };
    };
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return !element.hidden && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const intersects = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    const contacts = [...document.querySelectorAll('.r3-terrain-enemy-contact')].filter(visible);
    const places = [...document.querySelectorAll('.r3-terrain-territory-label, .r3-terrain-node-marker')].filter(visible);
    const mapRect = map.getContainer().getBoundingClientRect();
    const markerAnchors = [...document.querySelectorAll('[data-r3-marker-id]')]
      .filter(element => visible(element) && !element.dataset.movementProgress)
      .flatMap(element => {
        const longitude = Number(element.dataset.r3AuthoritativeLongitude);
        const latitude = Number(element.dataset.r3AuthoritativeLatitude);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
        const projected = map.project([longitude, latitude]);
        const rect = element.getBoundingClientRect();
        const offset = axis => ['r3MarkerOffset', 'formationDisplacement', 'contactDisplacement', 'toolbarDisplacement', 'placeAvoidanceDisplacement']
          .reduce((sum, prefix) => sum + (Number(element.dataset[`${prefix}${axis}`]) || 0), 0);
        const expectedX = mapRect.left + projected.x + offset('X');
        const expectedY = mapRect.top + projected.y + offset('Y');
        const actualX = rect.left + rect.width / 2;
        const actualY = rect.top + rect.height / 2;
        return [{ id: element.dataset.r3MarkerId, dx: actualX - expectedX, dy: actualY - expectedY }];
      });
    const centre = map.getCenter();
    let identity = window.__wp2iMapIdentities.get(map);
    if (!identity) {
      identity = window.__wp2iNextMapIdentity++;
      window.__wp2iMapIdentities.set(map, identity);
    }
    return {
      label,
      capturedAt: performance.now(),
      viewport: { width: innerWidth, height: innerHeight },
      mapInstanceIdentity: identity,
      sameMapInstance: map === window.__wp2iOriginalMap,
      center: [centre.lng, centre.lat],
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      padding: map.getPadding(),
      terrain: map.getTerrain?.() ?? null,
      lod: host?.getAttribute('data-overlay-lod') ?? null,
      presentationProfile: host?.getAttribute('data-terrain-profile') ?? null,
      terrainRelief: host?.getAttribute('data-terrain-relief') ?? null,
      canvas: { ...dimensions(canvas), backingWidth: canvas.width, backingHeight: canvas.height },
      mapContainer: dimensions(map.getContainer()),
      terrainContainer: dimensions(container),
      host: dimensions(host),
      selectedTerritory: document.querySelector('.r3-terrain-territory-label.selected')?.getAttribute('data-territory-id') ?? null,
      attackOrderReady: [...document.querySelectorAll('*')].some(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return element.textContent?.trim() === 'ATTACK ORDER READY'
          && !element.hidden && style.visibility !== 'hidden' && style.display !== 'none'
          && rect.width > 0 && rect.height > 0;
      }),
      enemyPlaceIntersections: contacts.flatMap(contact => places.flatMap(place => intersects(contact.getBoundingClientRect(), place.getBoundingClientRect()) ? [{
        contact: contact.getAttribute('data-r3-marker-id'),
        place: place.getAttribute('data-r3-marker-id')
      }] : [])),
      markerAnchors,
      trace: [...(window.__wp2iMapTrace ?? [])]
    };
  }, label);
}

async function clickPolygon(page) {
  const point = await page.evaluate(() => {
    const map = window.__r3TerrainMap;
    const centre = window.__r3TerritoryCentres?.['DE-03'];
    if (!map || !centre) throw new Error('Frankfurt territory centre unavailable');
    // Start at the authoritative territory centre, then try small deterministic
    // interior offsets if an HTML marker covers that canvas pixel.
    const candidates = [
      centre, [centre[0] + 0.35, centre[1] + 0.15], [centre[0] - 0.35, centre[1] - 0.15],
      [centre[0] + 0.45, centre[1] - 0.2], [centre[0] - 0.45, centre[1] + 0.2]
    ];
    const containerRect = map.getContainer().getBoundingClientRect();
    for (const coordinate of candidates) {
      const projected = map.project(coordinate);
      const feature = map.queryRenderedFeatures(projected, { layers: ['campaign-territories-fill'] })
        .find(candidate => candidate.properties?.territory_id === 'DE-03');
      const pageX = containerRect.left + projected.x;
      const pageY = containerRect.top + projected.y;
      const hit = document.elementFromPoint(pageX, pageY);
      if (feature && hit instanceof HTMLCanvasElement) return { x: pageX, y: pageY, coordinate };
    }
    throw new Error('No unobstructed safe DE-03 polygon pixel found near its territory centre');
  });
  await page.mouse.click(point.x, point.y);
  return point;
}

async function assertInvariant(scenario, before, after, transitionError) {
  if (transitionError) throw new Error(`${scenario}: Frankfurt transition failed: ${transitionError}`);
  const centreDelta = Math.hypot(after.center[0] - before.center[0], after.center[1] - before.center[1]);
  if (before.zoom < 4.8 || before.lod !== 'campaign' || before.terrainRelief !== 'physical') throw new Error(`${scenario}: invalid Campaign baseline: ${JSON.stringify(before)}`);
  if (!after.sameMapInstance || before.mapInstanceIdentity !== after.mapInstanceIdentity) throw new Error(`${scenario}: selection remounted MapLibre.`);
  if (after.selectedTerritory !== 'DE-03') throw new Error(`${scenario}: Frankfurt selection was not reflected.`);
  if (after.zoom < 4.8 || after.lod !== 'campaign' || after.terrainRelief !== 'physical') throw new Error(`${scenario}: selection entered Theatre/strategic-flat presentation.`);
  if (Math.abs(after.zoom - before.zoom) > 0.01 || Math.abs(after.pitch - before.pitch) > 0.1 || Math.abs(after.bearing - before.bearing) > 0.1 || centreDelta > 0.01) {
    throw new Error(`${scenario}: selection changed the terrain camera: ${JSON.stringify({ before, after })}`);
  }
  if (JSON.stringify(before.terrain) !== JSON.stringify(after.terrain)) throw new Error(`${scenario}: selection changed physical terrain.`);
  if (after.enemyPlaceIntersections.length) throw new Error(`${scenario}: enemy contacts overlap visible place labels: ${JSON.stringify(after.enemyPlaceIntersections)}`);
  assertGeographicAnchors(scenario, after);
}

function assertGeographicAnchors(scenario, state) {
  if (!state.markerAnchors.length) throw new Error(`${scenario}: no visible stationary markers were measured.`);
  const failures = state.markerAnchors.filter(anchor => Math.hypot(anchor.dx, anchor.dy) > 3);
  if (failures.length) throw new Error(`${scenario}: markers detached from map.project() anchors: ${JSON.stringify(failures)}`);
  const commonVerticalTranslation = state.markerAnchors.reduce((sum, anchor) => sum + anchor.dy, 0) / state.markerAnchors.length;
  if (Math.abs(commonVerticalTranslation) > 3) throw new Error(`${scenario}: common vertical overlay translation: ${commonVerticalTranslation}px`);
}

async function settleCamera(page, options, label) {
  await page.evaluate(options => new Promise(resolve => {
    const map = window.__r3TerrainMap;
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    map.once('idle', finish);
    map.jumpTo(options);
    // A missing remote DEM tile must not make the geographic assertion hang.
    setTimeout(finish, 5_000);
  }), options);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await snapshot(page, label);
  assertGeographicAnchors(label, state);
  return state;
}

async function runScenario({ name, activate }, savedCampaign) {
  const scenarioDir = `${outputDir}/${name}`;
  fs.mkdirSync(scenarioDir, { recursive: true });
  const { context, page } = await openSavedDusseldorfCampaign(name, savedCampaign.savedStorage);
  let transitionError = null;
  let activation = null;
  let skipped = false;
  try {
    await installRecorder(page);
    const before = await snapshot(page, 'before-frankfurt-selection');
    await page.screenshot({ path: `${scenarioDir}/before-frankfurt-selection.png`, fullPage: true });
    try {
      activation = await activate(page);
      if (activation?.skipped) skipped = true;
      if (!skipped) await page.waitForFunction(frankfurtSelected);
    } catch (error) {
      transitionError = error instanceof Error ? (error.stack ?? error.message) : String(error);
    }
    // Persist the complete transaction before evaluating a single invariant.
    const after = await snapshot(page, skipped ? 'frankfurt-surface-not-present' : 'immediate-after-frankfurt-selection');
    const cameraPresets = skipped ? [] : [
      await settleCamera(page, { center: [10.2, 51.1], zoom: 4.1, pitch: 0 }, `${name}:theatre-zoomed-out`),
      await settleCamera(page, { center: [8.68, 50.11], zoom: 7.2, pitch: 42 }, `${name}:selected-frankfurt`),
      await settleCamera(page, { center: before.center, zoom: before.zoom, pitch: before.pitch, bearing: before.bearing }, `${name}:campaign-return`)
    ];
    const evidence = { scenario: name, viewport, campaignAttempts: savedCampaign.campaignAttempts, setup: 'existing-manual-save-slot', naturalPortal: 'DE-02', target: 'DE-03', activation, skipped, transitionError, before, after, cameraPresets };
    fs.writeFileSync(`${scenarioDir}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
    await page.screenshot({ path: `${scenarioDir}/after-frankfurt-selection.png`, fullPage: true });
    console.log(`WP2I ${name} evidence:`, JSON.stringify(evidence, null, 2));
    if (!skipped) await assertInvariant(name, before, after, transitionError);
  } finally {
    await context.close();
  }
}

const savedCampaign = await findAndSaveNaturalDusseldorfCampaign();

await runScenario({
  name: 'territory-html-label',
  activate: async page => {
    await page.locator('.r3-terrain-territory-label[data-territory-id="DE-03"]').click({ force: true });
    return { method: 'territory-html-label' };
  }
}, savedCampaign);

await runScenario({
  name: 'enemy-contact-card',
  activate: async page => {
    const contact = page.locator('.r3-terrain-enemy-contact[data-territory-id="DE-03"]');
    if (!await contact.count()) return { method: 'enemy-contact-card', skipped: true, reason: 'No Frankfurt enemy/recon contact in this natural campaign' };
    const markerId = await contact.first().getAttribute('data-r3-marker-id');
    await contact.first().click();
    return { method: 'enemy-contact-card', markerId };
  }
}, savedCampaign);

await runScenario({
  name: 'maplibre-territory-polygon',
  activate: async page => ({ method: 'campaign-territories-fill', projectedPoint: await clickPolygon(page) })
}, savedCampaign);

await browser.close();
