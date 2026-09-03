const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG11B contextual guidance uses authoritative legality helpers', () => {
  const hint = read('src/components/TabletopContextHint.tsx');

  assert.match(hint, /getBoardMoveDestinations/);
  assert.match(hint, /getBoardCombatTargets/);
  assert.match(hint, /previewBoardAction/);
  assert.match(hint, /recover-piece/);
  assert.match(hint, /engineer-position/);
  assert.match(hint, /logistics-piece/);
  assert.match(hint, /pass-activation/);
  assert.match(hint, /Move \{preview\.movable\}/);
  assert.match(hint, /Attack \{preview\.attackers\}/);
  assert.match(hint, /Support \{preview\.supportTypes\}/);
  assert.match(hint, /Cards \{preview\.cards\}/);
});

test('BG11B compact rules reference is tied to Central Front campaign constants', () => {
  const rules = read('src/components/TabletopRulesReference.tsx');

  assert.match(rules, /CENTRAL_FRONT_CAMPAIGN_OBJECTIVES/);
  assert.match(rules, /CENTRAL_FRONT_BREAKTHROUGH_TARGET/);
  assert.match(rules, /CENTRAL_FRONT_FINAL_OBJECTIVE_TARGET/);
  assert.match(rules, /projectBoardCampaignStatus/);
  assert.match(rules, /Move, Attack, Recover, Engineer and Logistics each cost 1 Command Action/);
  assert.match(rules, /Invalid actions cost nothing and change nothing/);
  assert.match(rules, /Combat uses a seeded D20/);
  assert.match(rules, /holding at least \{CENTRAL_FRONT_FINAL_OBJECTIVE_TARGET\} objectives/);
});

test('BG11B guidance is presentation-only and integrated into the BG12E tabletop owner', () => {
  const layout = read('src/components/TabletopLayout.tsx');
  const hint = read('src/components/TabletopContextHint.tsx');
  const rules = read('src/components/TabletopRulesReference.tsx');

  assert.match(layout, /<TabletopContextHint \/>/);
  assert.match(layout, /<TabletopRulesReference \/>/);
  assert.match(hint, /data-bg-feedback="BG11B"/);

  for (const source of [hint, rules]) {
    assert.doesNotMatch(source, /dispatch\(/);
    assert.doesNotMatch(source, /MapLibre|maplibre|WebGL|TerrainMapPrototype|setFeatureState|addLayer/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|serialize|deserialize/);
  }
});

test('BG11B guidance remains compact and accessible', () => {
  const hint = read('src/components/TabletopContextHint.tsx');
  const rules = read('src/components/TabletopRulesReference.tsx');
  const css = read('src/components/tabletop-rules-reference.css');

  assert.match(hint, /aria-label="Contextual action guidance"/);
  assert.match(hint, /aria-label="Current legal action preview"/);
  assert.match(rules, /aria-expanded=\{open\}/);
  assert.match(rules, /aria-controls="tabletop-rules-reference"/);
  assert.match(rules, /aria-labelledby="tabletop-rules-reference-title"/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /pointer-events: none/);
});