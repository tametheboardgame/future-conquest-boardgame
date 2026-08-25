const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('the command shell exposes eight persistent command views', () => {
  const navigation = read('src/components/CommandNavigation.tsx');
  const app = read('src/App.tsx');

  for (const view of ['map', 'forces', 'operations', 'territories', 'engineering', 'logistics', 'intelligence', 'campaign']) {
    assert.match(navigation, new RegExp(`id: '${view}'`));
    assert.match(app, new RegExp(`currentView === '${view}'`));
  }
  assert.match(navigation, /aria-label="Board game views"/);
  assert.match(app, /PHASE VIII-D \/ OPERATIONAL CLARITY AND ONBOARDING/);
});

test('the map keeps operational controls while specialist tools move into dedicated views', () => {
  const app = read('src/App.tsx');

  assert.match(app, /className="workspace command-map-workspace"/);
  assert.match(app, /FORMATION ORDERS/);
  assert.match(app, /Issue movement order/);
  assert.match(app, /Begin operation/);
  assert.match(app, /<ForceOrganisationPanel[^>]+onChange=\{setState\}/s);
  assert.match(app, /Territorial administration/);
  assert.match(read('src/components/LogisticsCommand.tsx'), /Supply priority command/);
  assert.match(app, /Strategic picture/);
  assert.match(app, /Campaign control/);
});

test('resolve day remains globally available and writes only the dedicated autosave slot', () => {
  const app = read('src/App.tsx');

  assert.match(app, /className="global-resolve"/);
  assert.match(app, /Resolve all orders · day \{state\.turn\}/);
  assert.match(app, /writeCampaignSlot\(storage, next, 'autosave'\)/);
  assert.match(app, /beginMovementResolution\(state\)/);
  assert.match(app, /const next = advanceDay\(current\)/);
  assert.doesNotMatch(app, /persistence-save-proxy/);
});

test('command interface styles load last and switch from left navigation to mobile bottom navigation', () => {
  const main = read('src/main.tsx');
  const css = read('src/command-interface.css');

  assert.ok(main.indexOf("./command-interface.css") > main.indexOf("./europe-map.css"));
  assert.match(css, /\.command-workspace\s*\{[\s\S]*grid-template-columns:\s*96px minmax\(0, 1fr\)/);
  assert.match(css, /\.command-navigation\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.command-navigation\s*\{[\s\S]*position:\s*fixed[\s\S]*bottom:\s*0/);
  assert.match(css, /\.command-nav-items\s*\{[\s\S]*grid-template-columns:\s*repeat\(8/);
});

test('dedicated views expose the current strategic data without changing game state', () => {
  const app = read('src/App.tsx');

  assert.match(app, /frontlineTerritories/);
  assert.match(app, /supplyDisruptions/);
  assert.match(app, /enemyContacts/);
  assert.match(app, /occupationRequirement\(territory\.id\)/);
  assert.match(app, /openTerritoryOnMap/);
  assert.doesNotMatch(app, /version:\s*5/);
});
