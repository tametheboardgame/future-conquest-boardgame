const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG4D authoritative board placement remains the source of miniature destinations', () => {
  const app = read('src/App.tsx');
  const integration = read('src/game/board-state-render-integration.ts');
  const layer = read('src/presentation/r3-formation-miniatures-layer.ts');

  assert.match(app, /applyBoardProjectionToRendererState\(movementMapState, boardRenderProjection\)/);
  assert.match(integration, /taskGroups\[matchingLegacyGroup\.id\] = \{/);
  assert.match(integration, /location: piece\.spaceId/);
  assert.match(layer, /formationPresentationPosition\(group, terrainOperationalTerritoryCentres\)/);
  assert.doesNotMatch(layer, /state\.taskGroups\[[^\]]+\]\s*=/);
});

test('BG4D retargets from the current presentation position and does not restart travel for selection-only rebuilds', () => {
  const layer = read('src/presentation/r3-formation-miniatures-layer.ts');

  assert.match(layer, /const targetChanged = Boolean\(old && !sameFormationPoint\(old\.target, target\)\)/);
  assert.match(layer, /from: targetChanged \? current : old\?\.from \?\? current/);
  assert.match(layer, /startedAt: targetChanged \? now : old\?\.startedAt \?\? now/);
  assert.match(layer, /old\.from = old\.current; old\.target = target; old\.startedAt = performance\.now\(\)/);
});

test('BG4D miniature motion honours app and system reduced-motion preferences plus motion scale', () => {
  const wrapper = read('src/components/TerrainMapPrototype.tsx');
  const layer = read('src/presentation/r3-formation-miniatures-layer.ts');

  assert.match(wrapper, /data-reduced-motion=\{reducedMotion \? 'true' : 'false'\}/);
  assert.match(wrapper, /data-motion-scale=\{effectiveMotionScale\.toFixed\(1\)\}/);
  assert.match(layer, /closest<HTMLElement>\('\.r3-terrain-prototype-shell'\)/);
  assert.match(layer, /prefers-reduced-motion: reduce/);
  assert.match(layer, /shell\?\.dataset\.reducedMotion === 'true'/);
  assert.match(layer, /shell\?\.dataset\.motionScale/);
  assert.match(layer, /elapsed \/ this\.motionScale/);
  assert.match(layer, /FORMATION_PRESENTATION_ANIMATION_MS \* this\.motionScale/);
});

test('BG4D only repaints while a piece is genuinely travelling and retains lifecycle cleanup', () => {
  const layer = read('src/presentation/r3-formation-miniatures-layer.ts');

  assert.match(layer, /const travelling = !sameFormationPoint\(piece\.from, piece\.target\)/);
  assert.match(layer, /if \(animating\) this\.map\.triggerRepaint\(\)/);
  assert.match(layer, /this\.renderer\?\.dispose\(\)/);
  assert.match(layer, /disposeMiniature\(piece\.root\)/);
  assert.match(layer, /this\.pieces\.clear\(\)/);
});
