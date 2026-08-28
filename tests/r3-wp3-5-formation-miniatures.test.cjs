const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const layer = fs.readFileSync('src/presentation/r3-formation-miniatures-layer.ts', 'utf8');
const host = fs.readFileSync('src/components/TerrainMapPrototypeImpl.tsx', 'utf8');
const css = fs.readFileSync('src/r3-terrain-prototype.css', 'utf8');
const physicalCss = fs.readFileSync('src/wp3-5-physical-overlay.css', 'utf8');

test('WP3.5 formation miniatures use a MapLibre custom 3D layer with procedural physical geometry', () => {
  assert.match(layer, /implements CustomLayerInterface/);
  assert.match(layer, /renderingMode = '3d'/);
  assert.match(layer, /new WebGLRenderer\(\{ canvas: map\.getCanvas\(\), context: gl/);
  assert.match(layer, /defaultProjectionData\.mainMatrix/);
  assert.doesNotMatch(layer, /options\.modelViewProjectionMatrix/);
  assert.match(layer, /FIGURE_OFFSETS = \[\[-0\.5, -0\.2\], \[0, 0\.22\], \[0\.5, -0\.2\], \[-0\.25, 0\.55\], \[0\.25, 0\.55\]\] as const/);
  assert.match(layer, /new InstancedMesh\(geometry, material, FIGURE_OFFSETS\.length\)/);
  assert.match(layer, /CylinderGeometry/);
  assert.match(layer, /ConeGeometry/);
});

test('WP3.5 custom pieces derive geographic state, terrain elevation, state language and strategic presentation scale', () => {
  assert.match(layer, /formationPresentationPosition\(group, terrainOperationalTerritoryCentres\)/);
  assert.match(layer, /queryTerrainElevation\(lngLat\)/);
  assert.match(layer, /CLEARANCE_METRES/);
  for (const status of ['ready', 'moving', 'attacking', 'garrison', 'recovering', 'engineering', 'interdicting']) {
    assert.match(layer, new RegExp(`${status}: 0x`));
  }
  assert.match(layer, /presentationScaleForZoom/);
  assert.match(layer, /44_000/);
  assert.match(layer, /28_000/);
  assert.match(layer, /18_000/);
});

test('co-located formations keep one geographic root but receive deterministic local miniature offsets', () => {
  assert.match(layer, /clusterOffsets\(this\.state\)/);
  assert.match(layer, /coordinateKey\(point\)/);
  assert.match(layer, /VISUAL_GROUP_NAME/);
  assert.match(layer, /visual\?\.position\.set\(offset\[0\], offset\[1\], 0\)/);
  assert.match(layer, /piece\.root\.position\.set\(coordinate\.x, coordinate\.y, coordinate\.z\)/);
});

test('WP3.5 smoothing remains presentation-only and reduced motion settles immediately', () => {
  assert.match(layer, /interpolateFormationPresentation\(piece\.from, piece\.target, (?:elapsed|scaledElapsed)\)/);
  assert.match(layer, /FORMATION_PRESENTATION_ANIMATION_MS/);
  assert.match(layer, /this\.map\.triggerRepaint\(\)/);
  assert.doesNotMatch(layer, /state\.taskGroups\[[^\]]+\]\s*=/);
  assert.doesNotMatch(layer, /order\.progress\s*=/);
});

test('formation layer visibility follows Layers and replacement resources are disposed', () => {
  assert.match(layer, /this\.visible = layers\.friendlyFormations/);
  assert.match(layer, /piece\.root\.visible = this\.visible/);
  assert.match(layer, /disposeMiniature\(old\.root\)/);
  assert.match(layer, /material\.map\?\.dispose\(\); material\.dispose\(\)/);
});

test('movement bearing and interaction target use shared progress and presentation timing', () => {
  const movement = fs.readFileSync('src/presentation/r3-formation-movement.ts', 'utf8');
  const marker = fs.readFileSync('src/presentation/r3-formation-marker-presentation.ts', 'utf8');
  assert.match(layer, /formationForwardPathTarget\(path, progress\)/);
  assert.match(movement, /activePathSegment\(points, progress\)/);
  assert.match(marker, /interpolateFormationPresentation\(previous, target, now - startedAt\)/);
  assert.match(marker, /FORMATION_PRESENTATION_ANIMATION_MS/);
});

test('WP3.5 retains DOM interaction fallback but MapLibre inline opacity cannot repaint legacy cards over physical pieces', () => {
  assert.match(host, /map\.addLayer\(miniatureLayer\)/);
  assert.match(host, /retaining compatible markers/);
  assert.match(css, /data-physical-formations='ready'.*r3-terrain-task-group-marker/s);
  assert.match(css, /r3-terrain-task-group-marker:focus-visible/);
  assert.match(physicalCss, /r3-terrain-task-group-marker\s*\{[^}]*opacity:\s*0\s*!important/s);
  assert.match(physicalCss, /r3-terrain-task-group-marker:focus-visible\s*\{[^}]*opacity:\s*1\s*!important/s);
  assert.match(physicalCss, /r3-terrain-node-marker b\s*\{[^}]*visibility:\s*hidden/s);
});
