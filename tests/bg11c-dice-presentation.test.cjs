const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG11C D20 preview derives its chance from the authoritative combat preview', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /getBoardCombatPreview/);
  assert.match(combat, /hitChance\(preview\.target, preview\.attackModifier\)/);
  assert.match(combat, /const minimumDie = target - attackModifier/);
  assert.match(combat, /successfulFaces \* 5/);
  assert.match(combat, /Need \{chance\.minimumDie\}\+ on die/);
  assert.match(combat, /\{chance\.percent\}% hit chance/);
  assert.match(combat, /Roll D20 · 1 Command Action/);
});

test('BG11C resolved roll shows the authoritative equation and consequences', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');

  assert.match(combat, /result\.die/);
  assert.match(combat, /result\.attackTotal/);
  assert.match(combat, /result\.target/);
  assert.match(combat, /latestCombat\?\.modifiers\.supply/);
  assert.match(combat, /★ CRITICAL HIT/);
  assert.match(combat, /✓ HIT/);
  assert.match(combat, /× MISS/);
  assert.match(combat, /Damage \+\{consequence\.damageInflicted\}/);
  assert.match(combat, /Readiness -\{consequence\.readinessLoss\}/);
  assert.match(combat, /aria-live="polite"/);
});

test('BG11C is presentation-only and does not introduce a second RNG path', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg5-dice-combat.css');

  assert.match(combat, /dispatchBoardAction\(\{\s*type: 'attack-piece'/s);
  assert.doesNotMatch(combat, /Math\.random|crypto\.getRandomValues|nextBoardRandom/);
  assert.doesNotMatch(combat, /MapLibre|maplibre|WebGL|TerrainMapPrototype|setFeatureState|addLayer/);
  assert.match(combat, /data-bg-dice-presentation="BG11C"/);
  assert.match(css, /tabletop-d20-face/);
  assert.match(css, /tabletop-combat-result-reveal/);
});

test('BG11C dice feedback remains accessible without motion or colour', () => {
  const combat = read('src/components/TabletopCombatPanel.tsx');
  const css = read('src/bg5-dice-combat.css');

  assert.match(combat, /★ CRITICAL HIT/);
  assert.match(combat, /✓ HIT/);
  assert.match(combat, /× MISS/);
  assert.match(combat, /aria-label=\{`D20 rolled \$\{result\.die\}`\}/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /border: 2px solid CanvasText/);
});
