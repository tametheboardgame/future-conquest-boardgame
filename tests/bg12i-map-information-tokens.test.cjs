const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const helper = fs.readFileSync('src/presentation/bg12i-board-token-projection.ts', 'utf8');
const wrapper = fs.readFileSync('src/components/TerrainMapPrototype.tsx', 'utf8');
const css = fs.readFileSync('src/bg12i-map-information-tokens.css', 'utf8');
const packageDoc = fs.readFileSync('docs/BG12I-MAP-INFORMATION-BOARD-TOKENS.md', 'utf8');

test('BG12I annotates the existing marker layer from the authoritative board render projection', () => {
  assert.match(helper, /import type \{ BoardPresentationController, BoardRenderProjection \}/);
  assert.match(helper, /\.r3-terrain-task-group-marker\[data-group-id\]/);
  assert.match(helper, /\.r3-terrain-territory-label\[data-territory-id\]/);
  assert.match(helper, /projection\.pieces/);
  assert.match(helper, /projection\.spaceControllers/);
  assert.match(helper, /data-bg12i-readiness|bg12iReadiness/);
  assert.match(helper, /data-bg12i-damage|bg12iDamage/);
  assert.match(helper, /data-bg12i-supply|bg12iSupply/);
});

test('BG12I derives token state through the existing board provider and pure renderer seam', () => {
  assert.match(wrapper, /useBoardGameState/);
  assert.match(wrapper, /projectBoardStateForRenderer\(boardState\)/);
  assert.match(wrapper, /applyBg12iBoardTokens\(root, boardProjection\)/);
  assert.match(wrapper, /bg12iFormationTokens/);
  assert.match(wrapper, /bg12iControlTokens/);
});

test('BG12I formation pieces communicate readiness damage and exceptional supply without colour-only meaning', () => {
  assert.match(helper, /R\$\{piece\.readiness\}/);
  assert.match(helper, /D\$\{piece\.damage\}/);
  assert.match(helper, /piece\.supply === 'isolated' \? 'ISO' : 'SUP!'/);
  assert.match(helper, /Readiness \$\{piece\.readiness\} of 100, damage \$\{piece\.damage\} of 3/);
  assert.match(css, /\.bg12i-state-damage[\s\S]*border-style: double/);
  assert.match(css, /\.bg12i-state-supply[\s\S]*border-style: dashed/);
});

test('BG12I territory control uses shape tokens on existing geographic labels', () => {
  assert.match(helper, /player: '●'/);
  assert.match(helper, /enemy: '◆'/);
  assert.match(helper, /neutral: '□'/);
  assert.match(helper, /Expedition control/);
  assert.match(helper, /Defender control/);
  assert.match(css, /bg12i-control-token\[data-controller='player'\][\s\S]*border-radius: 50%/);
  assert.match(css, /bg12i-control-token\[data-controller='enemy'\][\s\S]*border-style: double/);
});

test('BG12I preserves the physical miniature hit target while removing the duplicate card skin', () => {
  assert.match(css, /data-physical-formations='ready'[\s\S]*r3-terrain-task-group-marker[\s\S]*opacity: 1/);
  assert.match(css, /border-color: transparent/);
  assert.match(css, /background: transparent/);
  assert.match(css, /\.bg12i-formation-state/);
  assert.doesNotMatch(css, /\.r3-terrain-task-group-marker\s*\{[^}]*display:\s*none/s);
});

test('BG12I materially reduces permanent map chrome while retaining accessible information', () => {
  assert.match(css, /\.r3-terrain-prototype-toolbar[\s\S]*right: auto/);
  assert.match(css, /\.r3-terrain-map-key[\s\S]*clip: rect\(0, 0, 0, 0\)/);
  assert.match(css, /\.r3-strategic-information-control[\s\S]*max-width: min\(184px/);
  assert.match(css, /\.r3-strategic-information-legend[\s\S]*clip: rect\(0, 0, 0, 0\)/);
  assert.match(wrapper, /aria-label="Strategic information layer"/);
  assert.match(wrapper, />\s*2D accessible map\s*</);
});

test('BG12I remains presentation-only and does not take rules MapLibre or BG12K drawer ownership', () => {
  assert.doesNotMatch(helper, /Math\.random|dispatchBoardAction|attack-piece|move-piece/);
  assert.doesNotMatch(helper, /from ['"]maplibre-gl['"]|maplibregl\.Map|new maplibregl/i);
  assert.doesNotMatch(helper, /from ['"]three['"]/);
  assert.match(packageDoc, /MapLibre retains map lifecycle, camera, terrain, DEM and geographic projection ownership/);
  assert.match(packageDoc, /BG12K remains responsible for the later general secondary-drawer architecture/);
  assert.doesNotMatch(wrapper, /secondary drawer|BG12K/);
});
