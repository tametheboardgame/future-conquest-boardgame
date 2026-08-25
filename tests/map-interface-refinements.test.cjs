const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('the map exposes an expandable ten-layer control', () => {
  const map = read('src/components/MapView.tsx');

  assert.match(map, /className="map-layer-control"/);
  assert.match(map, /<summary><span>Layers<\/span>/);
  for (const label of [
    'Country names',
    'Territory names',
    'Order prompts',
    'Friendly formations',
    'Enemy formations',
    'Operations and routes'
  ]) assert.match(map, new RegExp(label));
  assert.match(map, /checked=\{layers\[option\.id\]\}/);
  assert.match(map, /toggleLayer\(option\.id\)/);
});

test('country labels use full names and cover the previously omitted central European states', () => {
  const map = read('src/components/MapView.tsx');

  for (const country of [
    'United Kingdom',
    'Netherlands',
    'Belgium',
    'Luxembourg',
    'Switzerland',
    'Liechtenstein',
    'Austria',
    'Slovenia',
    'Montenegro',
    'North Macedonia',
    'Cyprus',
    'Georgia',
    'Armenia',
    'Azerbaijan'
  ]) assert.match(map, new RegExp(country));
  assert.match(map, /country-name-label/);
  assert.match(map, /\{label\.name\}<\/text>/);
  assert.doesNotMatch(map, /showTheatreLabels = zoomPercent <= 175/);
});

test('map marker classes are independently gated without removing territory selection', () => {
  const map = read('src/components/MapView.tsx');

  assert.match(map, /layers\.operations && Object\.values\(state\.operations\)/);
  assert.match(map, /layers\.enemyUnits && enemyContacts\.map/);
  assert.match(map, /layers\.friendlyUnits && Object\.entries\(groupsByTerritory\)/);
  assert.match(map, /layers\.orderPrompts && reachable/);
  assert.match(map, /layers\.territories && <>/);
  assert.match(map, /className="territory-hit-target"/);
});

test('mobile command navigation shows the BG1 board-game labels beneath a dedicated badge row', () => {
  const navigation = read('src/components/CommandNavigation.tsx');
  const css = read('src/map-interface-refinements.css');
  const main = read('src/main.tsx');

  for (const label of ['Board', 'Forces', 'Combat', 'Regions', 'Engineer', 'Logistics', 'Intel', 'Rules & Save']) {
    assert.match(navigation, new RegExp(`label: '${label.replace('&', '\\&')}'`));
  }
  assert.match(navigation, /command-nav-badge/);
  assert.match(navigation, /command-nav-label/);
  assert.match(css, /@media \(max-width: 540px\)[\s\S]*\.command-nav-code\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /@media \(max-width: 540px\)[\s\S]*\.command-nav-label\s*\{[\s\S]*display:\s*block/);
  assert.match(css, /@media \(max-width: 540px\)[\s\S]*\.command-nav-badge\s*\{[\s\S]*position:\s*static/);
  assert.ok(main.indexOf("./map-interface-refinements.css") > main.indexOf("./command-interface.css"));
});
