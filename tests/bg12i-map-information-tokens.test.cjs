const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const helper = fs.readFileSync('src/presentation/bg12i-board-token-projection.ts', 'utf8');
const wrapper = fs.readFileSync('src/components/TerrainMapPrototype.tsx', 'utf8');
const css = fs.readFileSync('src/bg12i-map-information-tokens.css', 'utf8');
const packageDoc = fs.readFileSync('docs/BG12I-MAP-INFORMATION-BOARD-TOKENS.md', 'utf8');
const workflow = fs.readFileSync('.github/workflows/bg12i-map-information-tokens.yml', 'utf8');
const capture = fs.readFileSync('scripts/capture-bg12i-map-information.mjs', 'utf8');

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

test('BG12I projects only the existing BG10 strategic objectives onto territory labels', () => {
  assert.match(helper, /import \{ CENTRAL_FRONT_CAMPAIGN_OBJECTIVES \} from ['"]\.\.\/game\/board-campaign['"]/);
  assert.match(helper, /CENTRAL_FRONT_CAMPAIGN_OBJECTIVES\.map\(objective => \[objective\.spaceId, objective\]/);
  assert.match(helper, /marker\.dataset\.bg12iObjective = objective\.label/);
  assert.match(helper, /token\.textContent = '★'/);
  assert.match(helper, /Strategic objective: \$\{objective\.label\}/);
  assert.doesNotMatch(helper, /FR-02|BE-01|DE-02|Paris|Brussels|Rhine-Ruhr/,
    'presentation helper must consume the BG10 registry rather than duplicate objective definitions');
  assert.match(css, /\.bg12i-objective-token[\s\S]*border:\s*2px double/);
  assert.match(css, /\.bg12i-objective-token[\s\S]*pointer-events:\s*none/);
});

test('BG12I preserves the physical miniature hit target while superseding the R4 selector skin', () => {
  assert.match(css, /r4-formation-selector[\s\S]*opacity: 1 !important/);
  assert.match(css, /r4-formation-selector[\s\S]*background: transparent !important/);
  assert.match(css, /r4-formation-selector > strong[\s\S]*opacity: 0 !important/);
  assert.match(css, /r4-formation-selector > \.bg12i-formation-state[\s\S]*display: flex !important[\s\S]*opacity: 1 !important/);
  assert.match(css, /span:not\(\.bg12i-formation-state\)[\s\S]*opacity: 0 !important/);
  assert.match(css, /selected-formation'\]:focus-visible[\s\S]*opacity: 1 !important/);
  assert.match(css, /\.bg12i-formation-state/);
  assert.doesNotMatch(css, /\.r3-terrain-task-group-marker\s*\{[^}]*display:\s*none/s);
});

test('BG12I materially reduces permanent map chrome while retaining accessible information', () => {
  assert.match(css, /--wp6-rail-width:\s*70px/);
  assert.match(css, /--wp66-rail-control-width:\s*64px/);
  assert.match(css, /--bg12e-rail-width:\s*min\(300px, 22vw\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.bg12e-board-zone > \.command-app-shell[\s\S]*padding:\s*0 0 52px !important/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.command-navigation[\s\S]*bottom:\s*var\(--bg12e-rail-height\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.command-nav-items button[\s\S]*height:\s*52px[\s\S]*min-height:\s*52px/);
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

test('BG12I exact-head workflow gates source contracts regression build and browser evidence', () => {
  assert.match(workflow, /BG12I_REF: \$\{\{ github\.event_name == 'pull_request'/);
  assert.match(workflow, /ref: \$\{\{ env\.BG12I_REF \}\}/);
  assert.match(workflow, /node --test tests\/bg12i-map-information-tokens\.test\.cjs/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /capture-bg12i-map-information\.mjs/);
  assert.match(workflow, /artifacts\/bg12i/);
});

test('BG12I browser gate measures tabletop budgets tokens accessibility and retained map interaction', () => {
  assert.match(capture, /1900, height: 829/);
  assert.match(capture, /1366, height: 768/);
  assert.match(capture, /640, height: 900/);
  assert.match(capture, /minMapWidthRatio: 0\.70/);
  assert.match(capture, /minMapHeightRatio: 0\.60/);
  assert.match(capture, /overflow <= 2/);
  assert.match(capture, /data-bg12i-formation-tokens/);
  assert.match(capture, /data-bg12i-control-tokens/);
  assert.match(capture, /\.bg12i-formation-state/);
  assert.match(capture, /\.bg12i-control-token/);
  assert.match(capture, /\.bg12i-objective-token/);
  assert.match(capture, /objectiveCount === 3/);
  assert.match(capture, /\['Brussels', 'Paris', 'Rhine-Ruhr'\]/);
  assert.match(capture, /objectiveGlyphs\[0\] === '★'/);
  assert.match(capture, /2D accessible map/);
  assert.match(capture, /__r3TerrainMap/);
  assert.match(capture, /data-selected-piece/);
  assert.match(capture, /data-rail-state/);
  assert.match(capture, /compact formation selection did not reveal Actions rail/);
  assert.match(capture, /interactionMapBox/);
});
