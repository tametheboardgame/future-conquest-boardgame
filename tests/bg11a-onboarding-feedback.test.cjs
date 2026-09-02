const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('BG11A first-turn guide teaches the authoritative board game and is replayable', () => {
  const onboarding = read('src/components/TabletopOnboarding.tsx');
  const shell = read('src/components/TabletopStatusShell.tsx');

  for (const term of ['Paris', 'Brussels', 'Rhine-Ruhr', 'Command Action', 'Move', 'Attack', 'Recover', 'Engineer', 'Logistics', 'Strategic cards']) {
    assert.match(onboarding, new RegExp(term));
  }

  for (const selector of ['tabletop-campaign-status', 'tabletop-status-grid', 'tabletop-activation-panel', 'tabletop-combat-panel', 'tabletop-support-panel']) {
    assert.match(onboarding, new RegExp(selector));
  }

  assert.match(onboarding, /future-conquest-bg11-onboarding-v1/);
  assert.match(onboarding, />Guide</);
  assert.match(onboarding, /Start playing/);
  assert.match(shell, /<TabletopOnboarding \/>/);
  assert.match(shell, /data-bg-onboarding="BG11A"/);
});

test('BG11A exposes disabled action reasons as visible status content', () => {
  const passReason = read('src/components/TabletopPassReason.tsx');
  const support = read('src/components/TabletopSupportPanel.tsx');
  const cards = read('src/components/TabletopCardHandPanel.tsx');
  const shell = read('src/components/TabletopStatusShell.tsx');

  assert.match(passReason, /Pass unavailable:/);
  assert.match(passReason, /preview\.reason/);
  assert.match(passReason, /role="status"/);
  assert.match(shell, /<TabletopPassReason \/>/);

  assert.match(support, /unavailableReasons/);
  assert.match(support, /Unavailable support action reasons/);
  assert.match(support, /preview\.reason/);

  assert.match(cards, /availabilityReason/);
  assert.match(cards, /Unavailable: \{availabilityReason\}/);
  assert.match(cards, /role="status"/);
});

test('BG11A remains presentation-only and provides non-colour accessibility cues', () => {
  const onboarding = read('src/components/TabletopOnboarding.tsx');
  const passReason = read('src/components/TabletopPassReason.tsx');
  const css = read('src/components/tabletop-onboarding.css');

  assert.doesNotMatch(onboarding, /maplibre|MapLibre|WebGL|TerrainMapPrototype|setFeatureState|addLayer/);
  assert.doesNotMatch(passReason, /maplibre|MapLibre|WebGL|TerrainMapPrototype|setFeatureState|addLayer/);
  assert.match(css, /outline:/);
  assert.match(css, /border-left:/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(onboarding, /aria-labelledby="tabletop-onboarding-title"/);
  assert.match(onboarding, /aria-expanded=\{open\}/);
});
