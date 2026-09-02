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
  assert.match(onboarding, /Replay the board-game guide/);
  assert.match(onboarding, /\{open \? 'Close guide' : 'Guide'\}/);
  assert.match(onboarding, /Start playing/);
  assert.match(shell, /<TabletopOnboarding \/>/);
  assert.match(shell, /data-bg-onboarding="BG11A"/);
});

test('BG11A replaces the visible legacy simulation tutorial without mutating tutorial save state', () => {
  const onboarding = read('src/components/TabletopOnboarding.tsx');
  const css = read('src/components/tabletop-onboarding.css');

  assert.match(onboarding, /bg11-boardgame-onboarding-installed/);
  assert.match(css, /\.bg11-boardgame-onboarding-installed \.tutorial-guide/);
  assert.match(css, /display: none !important/);
  assert.doesNotMatch(onboarding, /skipTutorial|progressTutorial|moveTutorial|state\.tutorial/);
});

test('BG11A exposes disabled action reasons as visible status content', () => {
  const passReason = read('src/components/TabletopPassReason.tsx');
  const support = read('src/components/TabletopSupportPanel.tsx');
  const cards = read('src/components/TabletopCardHandPanel.tsx');
  const cardCss = read('src/components/tabletop-card-hand.css');
  const shell = read('src/components/TabletopStatusShell.tsx');

  assert.match(passReason, /Pass unavailable:/);
  assert.match(passReason, /preview\.reason/);
  assert.match(passReason, /role="status"/);
  assert.match(shell, /<TabletopPassReason \/>/);

  assert.match(support, /unavailableReasons/);
  assert.match(support, /Unavailable support action reasons/);
  assert.match(support, /preview\.reason/);

  assert.match(cards, /availabilityReason/);
  assert.match(cards, /statusFeedback/);
  assert.match(cards, /`Unavailable: \$\{availabilityReason\}`/);
  assert.match(cards, /className="tabletop-card-feedback" role="status"/);
  assert.doesNotMatch(cards, /className="tabletop-card-availability"/);
  assert.match(cardCss, /\.tabletop-card-feedback[\s\S]*max-height: 30px/);
  assert.match(cardCss, /\.tabletop-card-feedback[\s\S]*overflow: auto/);
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

test('BG11A browser presentation probe validates the new guide while retaining legacy fallback', () => {
  const probe = read('scripts/probe-r3-wp6-5-interface-polish.mjs');

  assert.match(probe, /bg11-boardgame-onboarding-installed/);
  assert.match(probe, /\.tabletop-onboarding-card/);
  assert.match(probe, /Skip guide/);
  assert.match(probe, /board-game/);
  assert.match(probe, /\.tutorial-overlay/);
  assert.match(probe, /Restart tutorial/);
  assert.match(probe, /guidanceMode/);
  assert.match(probe, /horizontalOverflow/);
});
