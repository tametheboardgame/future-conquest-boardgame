const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/r3-wp9-integrated-validation.yml', 'utf8');
const probe = fs.readFileSync('scripts/probe-r3-wp9-session-continuity.mjs', 'utf8');
const review = fs.readFileSync('docs/reviews/R3-WP9-INTEGRATED-VALIDATION.md', 'utf8');

test('WP9 final gate validates pull-request heads and current main pushes', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.event_name == 'pull_request'/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /github\.sha/);
  assert.match(workflow, /ref: \$\{\{ env\.R3_WP9_REF \}\}/);
});

test('WP9 orchestrates regression, visual, persistence, performance and campaign evidence', () => {
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /tests\/persistence\.test\.cjs/);
  assert.match(workflow, /tests\/r3-wp8-performance-accessibility-resilience\.test\.cjs/);
  assert.match(workflow, /tests\/r3-wp2e-\*\.test\.cjs/);
  assert.match(workflow, /measure-r3-terrain-budget\.mjs/);
  assert.match(workflow, /probe-r3-wp4-battle-feedback\.mjs/);
  assert.match(workflow, /probe-r3-wp5-strategic-information\.mjs/);
  assert.match(workflow, /probe-r3-wp6-command-ui\.mjs/);
  assert.match(workflow, /probe-r3-wp6-accessibility\.mjs/);
  assert.match(workflow, /probe-r3-wp6-5-interface-polish\.mjs/);
  assert.match(workflow, /probe-r3-wp9-session-continuity\.mjs/);
  assert.match(workflow, /simulate:current-balance/);
  assert.match(workflow, /trace-current-engine-balance\.mjs/);
});

test('WP9 reuses the maintained contextual 2D6 evidence instead of retired combat UI', () => {
  const match = workflow.match(
    /- name: Capture current BG12H contextual 2D6 evidence[\s\S]*?(?=\n      - name: Prove BG12D)/
  );
  assert.ok(match, 'current contextual dice evidence step must remain present');
  const diceStep = match[0];

  assert.match(diceStep, /BG12G_R2E_REF: \$\{\{ env\.R3_WP9_REF \}\}/);
  assert.match(diceStep, /node scripts\/capture-bg12g-r2e-integrated\.mjs/);
  assert.doesNotMatch(diceStep, /legacy-ui=1/);
  assert.doesNotMatch(diceStep, /name: 'Combat'/);
  assert.doesNotMatch(diceStep, /bg12g-d6-stage/);
  assert.doesNotMatch(diceStep, /node --input-type=module/);
  assert.match(workflow, /artifacts\/bg12g-r2e/);
});

test('WP9 browser continuity follows the real launcher and campaign save controls', () => {
  assert.match(probe, /BEGIN CAMPAIGN/);
  assert.match(probe, /data-command-view="campaign"/);
  assert.match(probe, /New campaign difficulty/);
  assert.match(probe, /selectOption\('hard'\)/);
  assert.match(probe, /Manual Save/);
  assert.match(probe, /Manual campaign saved/);
  assert.match(probe, /page\.reload/);
  assert.match(probe, /CONTINUE CAMPAIGN/);
  assert.match(probe, /page\.waitForFunction/);
  assert.match(probe, /campaign-status-card/);
  assert.match(probe, /statusAfterLoad\.includes\(expectedDay\)/);
  assert.match(probe, /statusAfterLoad\.toLowerCase\(\)\.includes\(`seed \$\{saved\.seed\}`\)/);
});

test('WP9 review record keeps owner and deployed-main sign-off explicit', () => {
  assert.match(review, /Owner review remains \*\*pending\*\*/);
  assert.match(review, /owner review above is completed/);
  assert.match(review, /no material browser smoke, save\/load or visual-readability blocker remains/);
  assert.match(review, /integrated validation workflow is green on current `main`/);
  assert.match(review, /production deployment workflow has successfully verified the same current `main` revision live/);
  assert.match(review, /does not create a second deployment mechanism/);
});
