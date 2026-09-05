const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG12H replaces permanent Turn Combat Support navigation with one formation action surface', () => {
  const layout = read('src/components/TabletopLayout.tsx');
  const interaction = read('src/components/TabletopFormationInteraction.tsx');

  assert.match(layout, /type RailSurface = 'formation' \| 'cards'/);
  assert.match(layout, /id: 'formation', label: 'Actions'/);
  assert.match(layout, /activeSurface === 'formation'[\s\S]*?<TabletopFormationInteraction \/>/);
  assert.match(layout, /activeSurface === 'cards'[\s\S]*?<TabletopCardHandPanel \/>/);
  assert.doesNotMatch(layout, /id: 'activation', label: 'Turn'/);
  assert.doesNotMatch(layout, /id: 'combat', label: 'Combat'/);
  assert.doesNotMatch(layout, /id: 'support', label: 'Support'/);
  assert.match(interaction, /data-bg-package="BG12H"/);
});

test('BG12H action row is selected-formation contextual and uses existing authoritative APIs', () => {
  const source = read('src/components/TabletopFormationInteraction.tsx');

  assert.match(source, /getBoardMoveDestinations/);
  assert.match(source, /getBoardCombatTargets/);
  assert.match(source, /previewBoardAction/);
  assert.match(source, /type: 'move-piece'/);
  assert.match(source, /type: 'recover-piece'/);
  assert.match(source, /type: 'engineer-position'/);
  assert.match(source, /type: 'logistics-piece'/);
  assert.match(source, /type: 'pass-activation'/);
  assert.match(source, />Move<\/button>/);
  assert.match(source, />Attack<\/button>/);
  assert.match(source, />Support<\/button>/);
  assert.match(source, />Pass<\/button>/);
  assert.doesNotMatch(source, /Math\.random|seededRandom|nextRandom|rng\.state\s*=/);
});

test('BG12H keeps map selection primary and reuses the accepted authoritative combat panel', () => {
  const source = read('src/components/TabletopFormationInteraction.tsx');

  assert.match(source, /MAP_PIECE_SELECTOR/);
  assert.match(source, /map\.on\('click', TERRAIN_CLICK_LAYER_ID/);
  assert.match(source, /Choose a highlighted destination directly on the board/);
  assert.match(source, /Choose an adjacent enemy contact on the board/);
  assert.match(source, /<TabletopCombatPanel \/>/);
  assert.match(source, /future-conquest:dice-clatter/);
  assert.doesNotMatch(source, /Bg12gIntegratedDiceRenderer|attack-piece/,
    'BG12H must compose the accepted combat owner rather than duplicate dice/combat dispatch');
});

test('BG12H keeps accepted combat presentation mounted across activation handoff', () => {
  const source = read('src/components/TabletopFormationInteraction.tsx');

  assert.match(source, /if \(mode === 'attack' && \(combatRolling \|\| completionTimerRef\.current !== null\)\) return;/);
  assert.match(source, /detail\?\.phase === 'start'[\s\S]*?setCombatRolling\(true\)/);
  assert.match(source, /detail\?\.phase !== 'settled'[\s\S]*?completionTimerRef\.current = window\.setTimeout/);
  assert.match(source, /combatRolling, humanActivation, mode, selectedPieceId/);
});

test('BG12H confirmation and completion flow collapses accepted formation interactions', () => {
  const source = read('src/components/TabletopFormationInteraction.tsx');

  assert.match(source, /Confirm Move/);
  assert.match(source, /Confirm \{selectedSupportPreview\.label\}/);
  assert.match(source, /Confirm Pass/);
  assert.match(source, /collapseInteraction\(`/);
  assert.match(source, /detail\?\.phase !== 'settled'/);
  assert.match(source, /setTimeout\([\s\S]*?collapseInteraction\('Combat resolved/);
  assert.match(source, /setMode\(null\)/);
  assert.match(source, /setSelectedPieceId\(null\)/);
});

test('BG12H remains compact, accessible and does not take ownership of the map renderer', () => {
  const source = read('src/components/TabletopFormationInteraction.tsx');
  const css = read('src/components/tabletop-formation-interaction.css');

  assert.match(source, /aria-label="Formation actions"/);
  assert.match(source, /aria-label="Choose formation action"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Destination list/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(source, /new maplibregl\.Map|setTerrain|setCenter|flyTo|easeTo/);
});
