import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = process.env.R3_WP2F_ORIGIN ?? 'http://127.0.0.1:4173';
const outputDir = process.env.R3_WP2F_ARTIFACTS ?? 'artifacts/r3-wp2f';
const diagnosticNodeIds = ['N-DOVER', 'N-CALAIS'];
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
await page.addInitScript(() => {
  localStorage.setItem('future-conquest:intro-seen:v3', 'true');
  localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
});
await page.goto(`${origin}/?terrain=1`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
await page.locator('.startup-game-shell').waitFor({ state: 'visible' });
await page.locator('[data-command-view="map"]').click();
const host = page.locator('.r3-terrain-prototype');
await host.waitFor({ state: 'visible', timeout: 45_000 });
await page.waitForFunction(() => document.querySelector('.r3-terrain-prototype')?.getAttribute('data-status') === 'ready');

const evidence = { profiles: {}, physicalFormations: {}, worldMiniatures: {}, hover: {}, identity: {}, fallback: {} };
const persistEvidence = () => fs.writeFileSync(`${outputDir}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);

const activateCamera = async name => {
  const control = page.getByRole('button', { name, exact: true });
  await control.waitFor({ state: 'visible' });
  if (name === 'selected' && await control.isDisabled()) {
    await page.locator('.r3-terrain-territory-label').first().click({ force: true });
    await page.waitForFunction(cameraName => {
      const button = [...document.querySelectorAll('.r3-terrain-prototype-toolbar button')]
        .find(element => element.textContent?.trim() === cameraName);
      return button instanceof HTMLButtonElement && !button.disabled;
    }, name);
  }
  // WP2F owns settled visual-state assertions, not Playwright pointer
  // actionability. Dedicated interaction/selection gates exercise user clicks.
  await page.evaluate(cameraName => {
    const button = [...document.querySelectorAll('.r3-terrain-prototype-toolbar button')]
      .find(element => element.textContent?.trim() === cameraName);
    if (!(button instanceof HTMLButtonElement) || button.disabled) {
      throw new Error(`Camera control ${cameraName} is unavailable.`);
    }
    button.click();
  }, name);
};

for (const [button, expected, file] of [['theatre', 'theatre', 'theatre.png'], ['campaign', 'campaign', 'campaign.png'], ['selected', 'local', 'selected-local.png']]) {
  await activateCamera(button);
  await page.waitForFunction(lod => document.querySelector('.r3-terrain-prototype')?.getAttribute('data-overlay-lod') === lod, expected);
  await page.waitForTimeout(900);

  const profile = await page.evaluate(nodeIds => {
    const root = document.querySelector('.r3-terrain-prototype');
    const canvas = document.querySelector('.r3-terrain-prototype-canvas canvas');
    const map = window.__r3TerrainMap;
    const nodes = window.__r3StrategicNodes ?? [];
    if (!map || !(canvas instanceof HTMLCanvasElement)) throw new Error('terrain diagnostic API unavailable');
    const canvasRect = canvas.getBoundingClientRect();
    const markers = [...document.querySelectorAll('[data-r3-marker-id]')];
    const formations = markers.filter(marker => ['formation', 'selected-formation'].includes(marker.dataset.r3MarkerKind));
    const territories = markers.filter(marker => ['territory', 'selected-territory'].includes(marker.dataset.r3MarkerKind));
    const places = markers.filter(marker => ['node-major', 'node-secondary'].includes(marker.dataset.r3MarkerKind) && !marker.hidden);
    const rect = marker => {
      const box = marker.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        x: box.left + box.width / 2,
        y: box.top + box.height / 2
      };
    };
    const formationRects = formations.map(marker => ({
      id: marker.dataset.r3MarkerId,
      territoryId: marker.dataset.territoryId,
      moving: marker.dataset.movementProgress !== undefined,
      offsetX: Number(marker.dataset.r3MarkerOffsetX ?? 0),
      offsetY: Number(marker.dataset.r3MarkerOffsetY ?? 0),
      displacementX: Number(marker.dataset.formationDisplacementX ?? 0),
      displacementY: Number(marker.dataset.formationDisplacementY ?? 0),
      ...rect(marker)
    }));
    const collisions = [];
    const placeLabelCollisions = [];
    for (let i = 0; i < formationRects.length; i += 1) {
      for (let j = i + 1; j < formationRects.length; j += 1) {
        const a = formationRects[i];
        const b = formationRects[j];
        if (a.territoryId !== b.territoryId) continue;
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) collisions.push({ a: a.id, b: b.id, overlapX, overlapY });
      }
    }
    for (const formation of formationRects) {
      for (const label of [...territories.filter(item => !item.hidden), ...places]) {
        const place = rect(label);
        if (Math.min(formation.right, place.right) - Math.max(formation.left, place.left) > 0
          && Math.min(formation.bottom, place.bottom) - Math.max(formation.top, place.top) > 0) {
          placeLabelCollisions.push({ formation: formation.id, label: label.dataset.r3MarkerId });
        }
      }
    }
    // WP2F's anchor-spread contract protects stationary formations that share
    // one authoritative territory anchor. WP3 moving formations intentionally
    // render along their order path, so including them in a territory cluster
    // would misclassify valid presentation movement as geographic anchor drift.
    // They remain covered by visibility, collision, displacement and canvas
    // bounds checks below.
    const clusters = formationRects.filter(item => !item.moving).reduce((result, item) => {
      (result[item.territoryId] ??= []).push(item);
      return result;
    }, {});
    const formationAlignment = Object.entries(clusters).map(([territoryId, items]) => {
      const anchors = items.map(item => ({
        x: item.x - canvasRect.left - item.offsetX,
        y: item.y - canvasRect.top - item.offsetY
      }));
      const anchor = {
        x: anchors.reduce((sum, item) => sum + item.x, 0) / anchors.length,
        y: anchors.reduce((sum, item) => sum + item.y, 0) / anchors.length
      };
      const meanOffset = {
        x: items.reduce((sum, item) => sum + item.offsetX, 0) / items.length,
        y: items.reduce((sum, item) => sum + item.offsetY, 0) / items.length
      };
      return {
        territoryId,
        count: items.length,
        centroidDistancePx: Math.hypot(meanOffset.x, meanOffset.y),
        displacementPx: Math.max(...items.map(item => Math.hypot(item.displacementX, item.displacementY))),
        anchorSpreadPx: Math.max(0, ...anchors.map(item => Math.hypot(item.x - anchor.x, item.y - anchor.y))),
        terrainAwareAnchor: anchor
      };
    });
    const nodeDiagnostics = nodeIds.map(id => {
      const node = nodes.find(item => item.id === id);
      const nodeMarkers = [...document.querySelectorAll(`[data-node-id="${CSS.escape(id)}"]`)];
      const marker = nodeMarkers[0];
      if (!node || !(marker instanceof HTMLElement)) return { id, missing: true, markerCount: nodeMarkers.length };
      const projected = map.project(node.position);
      const box = rect(marker);
      const domCentre = { x: box.x - canvasRect.left, y: box.y - canvasRect.top };
      return {
        id,
        markerCount: nodeMarkers.length,
        visible: box.right > box.left && box.bottom > box.top,
        position: node.position,
        projected: { x: projected.x, y: projected.y },
        domCentre,
        flatProjectionDistanceWhilePitchedPx: Math.hypot(projected.x - domCentre.x, projected.y - domCentre.y),
        terrainElevation: map.queryTerrainElevation?.(node.position) ?? null
      };
    });
    return {
      lod: root?.getAttribute('data-overlay-lod'),
      scale: Number.parseFloat(getComputedStyle(root).getPropertyValue('--r3-marker-scale')),
      camera: { zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() },
      markerCount: markers.length,
      formationCount: formations.length,
      movingFormationCount: formationRects.filter(item => item.moving).length,
      visibleFormationCount: formations.filter(marker => !marker.hidden).length,
      territoryCount: territories.length,
      visibleTerritoryCount: territories.filter(marker => !marker.hidden).length,
      formationsInCanvas: formationRects.filter(item => item.right >= canvasRect.left && item.left <= canvasRect.right && item.bottom >= canvasRect.top && item.top <= canvasRect.bottom).length,
      collisions,
      placeLabelCollisions,
      formationAlignment,
      nodeDiagnostics,
      duplicateNodeLayerPresent: Boolean(map.getLayer('campaign-strategic-nodes'))
    };
  }, diagnosticNodeIds);

  const physical = await page.evaluate(() => {
    const map = window.__r3TerrainMap;
    const diagnostic = window.__r3FormationMiniatures;
    if (!map || !diagnostic) throw new Error('Three.js formation diagnostic unavailable');
    return {
      layerActive: Boolean(map.getLayer(diagnostic.layerId)),
      renderCount: diagnostic.renderCount,
      reducedMotion: diagnostic.reducedMotion,
      pieces: diagnostic.pieces.map(piece => ({
        ...piece,
        settlementDegrees: Math.hypot(piece.current[0] - piece.target[0], piece.current[1] - piece.target[1])
      }))
    };
  });

  const world = await page.evaluate(() => {
    const map = window.__r3TerrainMap;
    const diagnostic = window.__r3WorldMiniatures;
    const nodes = window.__r3StrategicNodes ?? [];
    if (!map || !diagnostic) throw new Error('Three.js world-miniature diagnostic unavailable');
    return {
      layerActive: Boolean(map.getLayer(diagnostic.layerId)),
      renderCount: diagnostic.renderCount,
      lod: diagnostic.lod,
      objects: diagnostic.objects.map(object => {
        const node = nodes.find(candidate => candidate.id === object.id);
        return { ...object, anchorErrorDegrees: node ? Math.hypot(object.position[0] - node.position[0], object.position[1] - node.position[1]) : null };
      })
    };
  });

  const flatProjection = await page.evaluate(async nodeIds => {
    const map = window.__r3TerrainMap;
    const nodes = window.__r3StrategicNodes ?? [];
    const canvas = document.querySelector('.r3-terrain-prototype-canvas canvas');
    if (!map || !(canvas instanceof HTMLCanvasElement)) throw new Error('terrain diagnostic API unavailable for flat projection');
    const originalPitch = map.getPitch();
    map.jumpTo({ pitch: 0 });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvasRect = canvas.getBoundingClientRect();
    const diagnostics = nodeIds.map(id => {
      const node = nodes.find(item => item.id === id);
      const marker = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (!node || !(marker instanceof HTMLElement)) return { id, missing: true };
      const previousDisplay = marker.style.getPropertyValue('display');
      const previousPriority = marker.style.getPropertyPriority('display');
      marker.style.setProperty('display', 'flex', 'important');
      const box = marker.getBoundingClientRect();
      const domCentre = {
        x: box.left + box.width / 2 - canvasRect.left,
        y: box.top + box.height / 2 - canvasRect.top
      };
      const projected = map.project(node.position);
      if (previousDisplay) marker.style.setProperty('display', previousDisplay, previousPriority);
      else marker.style.removeProperty('display');
      return {
        id,
        projected: { x: projected.x, y: projected.y },
        domCentre,
        distancePx: Math.hypot(projected.x - domCentre.x, projected.y - domCentre.y)
      };
    });
    map.jumpTo({ pitch: originalPitch });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { pitch: 0, diagnostics };
  }, diagnosticNodeIds);

  evidence.profiles[expected] = { ...profile, flatProjection };
  evidence.physicalFormations[expected] = physical;
  evidence.worldMiniatures[expected] = world;
  await page.screenshot({ path: `${outputDir}/${file}`, fullPage: true });
  persistEvidence();

  if (profile.scale > 1.081) throw new Error(`marker clamp exceeded in ${expected}`);
  if (!physical.layerActive || physical.renderCount < 1 || physical.pieces.length < 4 || physical.pieces.some(piece => !piece.visible)) {
    throw new Error(`physical formation layer is not active and visible in ${expected}: ${JSON.stringify(physical)}`);
  }
  if (!physical.reducedMotion || physical.pieces.some(piece => piece.settlementDegrees > 1e-9)) {
    throw new Error(`reduced-motion physical pieces did not settle in ${expected}: ${JSON.stringify(physical.pieces)}`);
  }
  const visibleCities = world.objects.filter(object => object.visible && ['capital', 'city'].includes(object.type));
  const visibleInfrastructure = world.objects.filter(object => object.visible && !['capital', 'city', 'airport'].includes(object.type));
  if (!world.layerActive || world.renderCount < 1 || visibleCities.length < 2 || visibleInfrastructure.length < 2) {
    throw new Error(`physical city/infrastructure layer is not active and visible in ${expected}: ${JSON.stringify(world)}`);
  }
  if (world.objects.some(object => object.anchorErrorDegrees !== 0 || !Number.isFinite(object.elevation) || object.clearance < 10 || object.clearance > 60)) {
    throw new Error(`world miniature geographic/grounding contract failed in ${expected}: ${JSON.stringify(world.objects)}`);
  }
  if (profile.visibleFormationCount !== profile.formationCount) throw new Error(`player formation hidden by declutter in ${expected}`);
  if (profile.visibleTerritoryCount !== profile.territoryCount) throw new Error(`territory label hidden by declutter in ${expected}`);
  if (profile.collisions.length) throw new Error(`formation rectangles intersect in ${expected}: ${JSON.stringify(profile.collisions)}`);
  if (profile.placeLabelCollisions.length) throw new Error(`formation intersects a place label in ${expected}: ${JSON.stringify(profile.placeLabelCollisions)}`);
  if (profile.formationAlignment.some(item => item.displacementPx > 97)) throw new Error(`formation displacement exceeded budget in ${expected}`);
  if (profile.formationAlignment.some(item => item.anchorSpreadPx > 2)) throw new Error(`stationary formation terrain anchors diverged in ${expected}`);
  if ((expected === 'theatre' || expected === 'campaign') && profile.formationsInCanvas !== profile.formationCount) throw new Error(`formation outside ${expected} canvas`);
  if (profile.duplicateNodeLayerPresent) throw new Error(`duplicate strategic-node layer remains in ${expected}`);
  if (profile.nodeDiagnostics.some(node => node.missing || node.markerCount !== 1)) throw new Error(`strategic node duplication/missing marker failed in ${expected}`);
  if (flatProjection.diagnostics.some(node => node.missing || node.distancePx > 3)) throw new Error(`strategic node flat projection failed in ${expected}: ${JSON.stringify(flatProjection.diagnostics)}`);
}

// Presentation controls must persist independently of camera and campaign-state
// reconciliation, then restore every default information category on request.
const layersControl = page.locator('.r3-terrain-layer-control');
if (!(await layersControl.isVisible())) throw new Error('terrain Layers control is not visible');
await layersControl.locator('summary').click();
const toggles = ['Territory names', 'Friendly formations', 'Cities and hubs', 'Ports'];
// WP2F validates persisted presentation state, not pointer actionability. A
// separate alert strip may legitimately occlude the control in this fixture.
for (const label of toggles) await layersControl.getByLabel(label, { exact: true }).uncheck({ force: true });
await activateCamera('campaign');
await page.waitForTimeout(900);
for (const label of toggles) {
  if (await layersControl.getByLabel(label, { exact: true }).isChecked()) throw new Error(`${label} did not remain disabled through camera refresh`);
}
for (const label of toggles) await layersControl.getByLabel(label, { exact: true }).check({ force: true });
await page.locator('.r3-terrain-territory-label:not([hidden])').nth(1).click();
await page.waitForTimeout(100);
for (const label of toggles) {
  if (!(await layersControl.getByLabel(label, { exact: true }).isChecked())) throw new Error(`${label} did not remain enabled through state reconciliation`);
}
if (await page.locator('.r3-terrain-territory-label:not([hidden])').count() !== await page.locator('.r3-terrain-territory-label').count()) {
  throw new Error('unselected territory labels disappeared after selection');
}

await page.evaluate(() => { window.__wp2fMarkerNodes = new Map([...document.querySelectorAll('[data-r3-marker-id]')].map(node => [node.dataset.r3MarkerId, node])); });
const selectedBefore = await page.locator('.r3-terrain-territory-label.selected').getAttribute('data-territory-id');
const canvas = page.locator('.r3-terrain-prototype-canvas canvas');
const box = await canvas.boundingBox();
if (!box) throw new Error('terrain canvas has no rendered bounds');
let hovered = false;
for (let y = 0.25; y <= 0.75 && !hovered; y += 0.1) {
  for (let x = 0.2; x <= 0.8 && !hovered; x += 0.1) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
    hovered = await canvas.evaluate(node => node.style.cursor === 'pointer');
  }
}
if (!hovered) throw new Error('pointer sweep did not encounter a territory');
evidence.hover.entered = true;
await page.mouse.move(1, 1);
await page.waitForFunction(() => document.querySelector('.r3-terrain-prototype-canvas canvas')?.style.cursor !== 'pointer', undefined, { timeout: 5_000 });
evidence.hover.cleared = await canvas.evaluate(node => node.style.cursor !== 'pointer');
evidence.hover.selectionUnchanged = selectedBefore === await page.locator('.r3-terrain-territory-label.selected').getAttribute('data-territory-id');
evidence.identity = await page.evaluate(() => {
  const prior = window.__wp2fMarkerNodes;
  const current = [...document.querySelectorAll('[data-r3-marker-id]')];
  const unchanged = current.filter(node => prior.get(node.dataset.r3MarkerId) === node).length;
  return { current: current.length, unchanged };
});
if (!evidence.hover.selectionUnchanged || evidence.identity.unchanged !== evidence.identity.current) throw new Error('hover/zoom replaced identity or changed selection');
evidence.territoryFillPolicy = 'ordinary:0;hover:0.075;selected:0.13;targeted:0.16';
persistEvidence();
await browser.close();

// The compatibility query must bypass the accelerated terrain renderer while
// retaining a usable campaign map and formation controls.
const fallbackBrowser = await chromium.launch({ headless: true });
const fallbackPage = await fallbackBrowser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
await fallbackPage.addInitScript(() => {
  localStorage.setItem('future-conquest:intro-seen:v3', 'true');
  localStorage.setItem('future-conquest-tutorial-seen-v1', 'true');
});
await fallbackPage.goto(`${origin}/?terrain=0`, { waitUntil: 'domcontentloaded' });
await fallbackPage.getByRole('button', { name: 'BEGIN CAMPAIGN', exact: true }).click();
await fallbackPage.locator('.startup-game-shell').waitFor({ state: 'visible' });
await fallbackPage.locator('[data-command-view="map"]').click();
const fallbackMap = fallbackPage.locator('.europe-map');
await fallbackMap.waitFor({ state: 'visible' });
await fallbackPage.waitForFunction(() => document.querySelectorAll('.europe-map .task-group-marker').length >= 4);
evidence.fallback = {
  usable: await fallbackMap.isVisible(),
  terrainRendererAbsent: await fallbackPage.locator('.r3-terrain-prototype').count() === 0,
  formations: await fallbackPage.locator('.europe-map .task-group-marker').count()
};
await fallbackPage.screenshot({ path: `${outputDir}/terrain-zero-fallback.png`, fullPage: true });
if (!evidence.fallback.usable || !evidence.fallback.terrainRendererAbsent || evidence.fallback.formations < 4) {
  throw new Error(`terrain=0 fallback unusable: ${JSON.stringify(evidence.fallback)}`);
}
persistEvidence();
await fallbackBrowser.close();
console.log(JSON.stringify(evidence, null, 2));
