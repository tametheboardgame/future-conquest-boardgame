const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG1C exposes a Current Activation panel with board-game action hierarchy', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /Current Activation/);
  assert.match(panel, />Move<\/button>/);
  assert.match(panel, />Attack<\/button>/);
  assert.match(panel, />Pass Activation<\/button>/);
  assert.match(panel, /Recover/);
  assert.match(panel, /Engineer/);
  assert.match(panel, /Logistics/);
});

test('BG1C delegates Move and Attack to existing App-owned legal action controls', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.match(panel, /\.map-context-panel \[data-tutorial="move-action"\]/);
  assert.match(panel, /\.map-context-panel \[data-tutorial="attack-action"\]/);
  assert.match(panel, /firstEnabledAction/);
  assert.match(panel, /\.click\(\)/);
  assert.match(panel, /Pass Activation<\/button>/);
  assert.match(panel, /disabled title="Alternating-activation passing becomes authoritative in BG3"/);
});

test('BG1C remains presentation-only and does not import game rules or renderer infrastructure', () => {
  const panel = read('src/components/TabletopActivationPanel.tsx');

  assert.doesNotMatch(panel, /from ['"]\.\.\/game\//);
  assert.doesNotMatch(panel, /MapView|TerrainMapPrototype|maplibre|WebGL|newGame|issueMove|beginOperation/);
  assert.match(panel, /does not calculate outcomes/);
  assert.match(panel, /does not.*touch the protected map\/render lifecycle/s);
});

test('BG1C mounts without breaking the status-shell adjacency contract', () => {
  const main = read('src/main.tsx');

  assert.match(main, /TabletopStatusShell/);
  assert.match(main, /TabletopActivationPanel/);
  assert.match(main, /<TabletopStatusShell \/>\s*<App \/>\s*<TabletopActivationPanel \/>/);
  assert.match(main, /bg1-current-activation\.css/);
});
