const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const movement = fs.readFileSync('src/presentation/r3-formation-movement.ts', 'utf8');

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing start anchor: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing end anchor: ${end}`);
  return source.slice(from, to);
}

test('WP3.7 resolves the authoritative day exactly once before staging presentation', () => {
  const advance = section(app, '  const advanceDay = (current: GameState) => {', '  const beginMovementResolution');
  const beat = section(app, '  const beginMovementResolution = (current: GameState) => {', '  const openTerritoryOnMap');
  assert.equal((advance.match(/endTurn\(/g) ?? []).length, 1);
  assert.match(advance, /const next = endTurn\(current\);/);
  assert.match(beat, /movementResolutionLockRef\.current/);
  assert.match(beat, /const next = advanceDay\(current\);/);
  assert.doesNotMatch(beat, /endTurn\(/);
  assert.match(app, /beginMovementResolution\(state\);/);
  assert.match(app, /beginMovementResolution\(markSupplyWarningAcknowledged\(state\)\);/);
});

test('WP3.7 keeps next-day command state hidden while formation positions animate', () => {
  assert.match(app, /const movementMapState: GameState = movementResolution\?\.phase === 'playing'/);
  assert.match(app, /\{ \.\.\.state, taskGroups: movementResolution\.next\.taskGroups \}/);
  assert.doesNotMatch(app, /movementMapState[^;]*territories:\s*movementResolution\.next\.territories/s);
  assert.match(app, /applyBoardProjectionToRendererState\(movementMapState, boardRenderProjection\)/);
  assert.match(app, /<TerrainMapPrototype\s+state=\{renderedMapState\}/);
  assert.match(app, /<MapView\s+state=\{renderedMapState\}/);
  assert.match(app, /setState\(movementResolution\.next\);\s*setMovementResolution\(null\);/s);
  assert.match(app, /window\.setTimeout\(\(\) => \{\s*setState\(movementResolution\.next\)/s);
  assert.match(app, /aria-busy=\{Boolean\(movementResolution\)\}/);
  assert.match(app, /r3-movement-resolution-lock/);
});

test('WP3.7 invasion presentation starts only after authoritative attack-day resolution', () => {
  assert.match(movement, /group\.status === 'attacking' && order\?\.type === 'attack'/);
  assert.match(movement, /order\.days <= 0/);
  assert.match(movement, /const invasionAnchor = territoryCentres\[order\.target\]/);
  assert.match(movement, /return \[origin, invasionAnchor\]/);
  assert.match(movement, /return order\.days > 0 \? path\.at\(-1\) \?\? path\[0\] : path\[0\]/);
  assert.doesNotMatch(movement, /group\.location\s*=/);
  assert.doesNotMatch(movement, /controller\s*=/);
  assert.doesNotMatch(movement, /occupation\s*=/);
});

test('WP3.7 movement beat is concurrent, bounded and reduced-motion aware', () => {
  const presentationDuration = Number(movement.match(/FORMATION_PRESENTATION_ANIMATION_MS = (\d+)/)?.[1]);
  const beatDuration = Number(app.match(/MOVEMENT_RESOLUTION_BEAT_MS = (\d+)/)?.[1]);
  const reducedDuration = Number(app.match(/MOVEMENT_RESOLUTION_REDUCED_MS = (\d+)/)?.[1]);
  assert.ok(presentationDuration >= 1000 && presentationDuration <= 3000);
  assert.ok(beatDuration >= presentationDuration && beatDuration <= 3000);
  assert.ok(reducedDuration >= 0 && reducedDuration <= 250);
  assert.match(app, /Object\.values\(current\.taskGroups\)\.some/);
  assert.doesNotMatch(app, /for\s*\([^)]*taskGroups[^)]*\)[\s\S]*?setTimeout/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /ordered formations resolving concurrently/);
});

test('WP3.7 only stages a beat when an order changes strategic presentation position', () => {
  const beat = section(app, '  const beginMovementResolution = (current: GameState) => {', '  const openTerritoryOnMap');
  assert.match(beat, /order\.type === 'move'/);
  assert.match(beat, /resolved\.location !== group\.location \|\| resolved\.order\?\.progress !== order\.progress/);
  assert.match(beat, /order\.type === 'attack' && order\.days === 0/);
  assert.match(beat, /if \(!hasVisibleMovement\) \{\s*setState\(next\);\s*return;/s);
});
