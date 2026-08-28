const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const layer = fs.readFileSync('src/presentation/r3-formation-miniatures-layer.ts', 'utf8');

test('WP3.6 identifies the canonical Future Conquest powered-armour visual family', () => {
  assert.match(layer, /R3_FUTURE_SOLDIER_VISUAL_FAMILY = 'future-conquest-powered-armour'/);
  assert.match(layer, /R3_FUTURE_SOLDIER_REFERENCE = 'Future Conquest Armour Revision Sheet\.png'/);
  assert.match(layer, /visualFamily: R3_FUTURE_SOLDIER_VISUAL_FAMILY/);
});

test('WP3.6 soldiers retain the recognisable canonical powered-armour signature', () => {
  for (const component of [
    'powered-thighs',
    'powered-greaves',
    'modular-chest-plate',
    'shoulder-plates',
    'sealed-combat-helmet',
    'multispectral-visor',
    'power-pack',
    'carried-energy-rifle'
  ]) assert.match(layer, new RegExp(component));

  assert.match(layer, /armour: new MeshStandardMaterial/);
  assert.match(layer, /undersuit: new MeshStandardMaterial/);
  assert.match(layer, /accent: new MeshStandardMaterial/);
  assert.match(layer, /weapon: new MeshStandardMaterial/);
  assert.match(layer, /visor: new MeshStandardMaterial/);
  assert.doesNotMatch(layer, /const material = new MeshStandardMaterial\(\{ color: statusColours\[group\.status\]/);
});

test('WP3.6 keeps the primary energy rifle as separate carried equipment in the soldier geometry', () => {
  assert.match(layer, /function rifleParentMatrix\(status/);
  assert.match(layer, /carried-energy-rifle-and-power-pack/);
  assert.match(layer, /rifleMatrix/);
  assert.match(layer, /boxGeometry\(\[0\.10, 0\.43, 0\.10\]/);
  assert.match(layer, /boxGeometry\(\[0\.055, 0\.28, 0\.055\]/);
  assert.match(layer, /boxGeometry\(\[0\.12, 0\.16, 0\.11\]/);
});

test('WP3.6 uses deterministic five-figure composition and strategy-map LOD', () => {
  assert.match(layer, /FIGURE_OFFSETS = \[\[-0\.5, -0\.2\], \[0, 0\.22\], \[0\.5, -0\.2\], \[-0\.25, 0\.55\], \[0\.25, 0\.55\]\] as const/);
  assert.match(layer, /type MiniatureLod = 'theatre' \| 'campaign' \| 'local'/);
  assert.match(layer, /lod === 'theatre' \? 3 : lod === 'campaign' \? 4 : 5/);
  assert.match(layer, /const figureLimit = selected \? 5/);
  assert.match(layer, /detail\.visible = selected \|\| lod === 'local'/);
  assert.match(layer, /visibleFigureCount/);
});

test('WP3.6 batches the five soldiers instead of issuing one draw call per body part', () => {
  assert.match(layer, /import \{ mergeGeometries \} from 'three\/addons\/utils\/BufferGeometryUtils\.js'/);
  assert.match(layer, /InstancedMesh/);
  assert.match(layer, /const SOLDIER_BATCH_COUNT = 7/);
  assert.match(layer, /new InstancedMesh\(geometry, material, FIGURE_OFFSETS\.length\)/);
  assert.match(layer, /child\.count = figureLimit/);
  assert.match(layer, /soldierDrawBatches: SOLDIER_BATCH_COUNT/);
});

test('WP3.6 remains procedural, presentation-only and preserves the proven geographic/fallback contract', () => {
  assert.doesNotMatch(layer, /GLTFLoader|FBXLoader|OBJLoader|https?:\/\//);
  assert.match(layer, /formationPresentationPosition\(group, terrainOperationalTerritoryCentres\)/);
  assert.match(layer, /queryTerrainElevation\(lngLat\)/);
  assert.match(layer, /defaultProjectionData\.mainMatrix/);
  assert.match(layer, /piece\.root\.position\.set\(coordinate\.x, coordinate\.y, coordinate\.z\)/);
  assert.match(layer, /interpolateFormationPresentation\(piece\.from, piece\.target, (?:elapsed|scaledElapsed)\)/);
  assert.doesNotMatch(layer, /state\.taskGroups\[[^\]]+\]\s*=/);
  assert.doesNotMatch(layer, /order\.progress\s*=/);
});
