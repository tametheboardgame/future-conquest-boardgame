const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG1D promotes the board-game primary navigation and BG8 activates its reserved Cards control', () => {
  const navigation = read('src/components/CommandNavigation.tsx');

  assert.match(navigation, /const PRIMARY_ITEMS/);
  assert.match(navigation, /label: 'Board'/);
  assert.match(navigation, /label: 'Forces'/);
  assert.match(navigation, /label: 'Combat'/);
  assert.match(navigation, /label: 'Rules & Save'/);
  assert.match(navigation, />Cards<\/span>/);
  assert.match(navigation, /aria-controls="tabletop-card-hand"/);
  assert.match(navigation, /Focus strategic card hand/);
  assert.doesNotMatch(navigation, /Cards become playable in BG8/);
});

test('BG1D demotes simulation-era workspaces without deleting their routes', () => {
  const navigation = read('src/components/CommandNavigation.tsx');

  assert.match(navigation, /const LEGACY_ITEMS/);
  assert.match(navigation, /label: 'Regions'/);
  assert.match(navigation, /label: 'Engineer'/);
  assert.match(navigation, /label: 'Logistics'/);
  assert.match(navigation, /label: 'Intel'/);
  assert.match(navigation, /<details className="command-nav-legacy"/);
  assert.match(navigation, />More<\/b>/);
});

test('BG1D remains presentation-only navigation and does not import board authority', () => {
  const navigation = read('src/components/CommandNavigation.tsx');
  const css = read('src/bg1-compact-navigation.css');
  const main = read('src/main.tsx');

  assert.doesNotMatch(navigation, /from ['"]\.\.\/game\//);
  assert.doesNotMatch(navigation, /MapView|TerrainMapPrototype|maplibre|WebGL/);
  assert.match(css, /temporary access/);
  assert.match(main, /bg1-compact-navigation\.css/);
});
