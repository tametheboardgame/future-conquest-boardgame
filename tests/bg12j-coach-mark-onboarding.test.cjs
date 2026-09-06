const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const overlay = fs.readFileSync('src/components/TutorialOverlay.tsx', 'utf8');
const css = fs.readFileSync('src/components/tutorial-explanation.css', 'utf8');
const clarity = fs.readFileSync('src/game/operational-clarity.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const packageDoc = fs.readFileSync('docs/BG12J-COACH-MARK-ONBOARDING.md', 'utf8');
const capture = fs.readFileSync('scripts/capture-bg12j-coach-mark-onboarding.mjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/bg12j-coach-mark-onboarding.yml', 'utf8');

test('BG12J keeps the existing tutorial state machine and anchored positioning engine', () => {
  assert.match(overlay, /document\.querySelector<HTMLElement>\(resolvedSelector\)/);
  assert.match(overlay, /ResizeObserver/);
  assert.match(overlay, /visualViewport/);
  assert.match(overlay, /scrollIntoView\(\{ block: 'center'/);
  assert.match(app, /tutorialAnchorSelector/);
  assert.match(app, /anchorSelector=\{tutorialAnchorSelector\}/);
  assert.match(clarity, /export const TUTORIAL_STEPS/);
  assert.match(clarity, /trigger: 'select-formation'/);
  assert.match(clarity, /trigger: 'begin-operation'/);
  assert.match(packageDoc, /does not rewrite tutorial progression/);
});

test('BG12J coach mark is materially smaller and removes the old full-screen dimming treatment', () => {
  assert.match(css, /BG12J — Coach-mark onboarding/);
  assert.match(css, /width: min\(312px, calc\(100vw - 20px\)\)/);
  assert.match(css, /max-height: min\(42vh, 300px\)/);
  assert.match(css, /width: min\(300px, calc\(100vw - 16px\)\)/);
  assert.match(css, /max-height: min\(34vh, 270px\)/);
  assert.match(css, /@keyframes bg12jCoachPulse/);
  const bg12jSection = css.split('/* BG12J — Coach-mark onboarding.')[1];
  assert.ok(bg12jSection, 'BG12J CSS section missing');
  assert.doesNotMatch(bg12jSection, /9999px/);
  assert.match(css, /tutorial-actions \.primary[\s\S]*width: auto/);
});

test('BG12J preserves action context, navigation and accessibility instead of hiding tutorial state', () => {
  assert.match(overlay, /aria-live="polite"/);
  assert.match(overlay, /aria-label="Guided campaign tutorial"/);
  assert.match(overlay, /WHY IT MATTERS/);
  assert.match(overlay, /COMPLETE WHEN/);
  assert.match(overlay, /data-wp8-action-context="true"/);
  assert.match(overlay, /Skip tutorial/);
  assert.match(overlay, /Back/);
  assert.match(packageDoc, /Long content may scroll inside the compact coach surface/);
});

test('BG12J keeps the board interactive outside the coach card and respects reduced motion', () => {
  const baseCss = fs.readFileSync('src/operational-clarity.css', 'utf8');
  assert.match(baseCss, /\.tutorial-guide[\s\S]*pointer-events:\s*none/);
  assert.match(baseCss, /\.tutorial-overlay[\s\S]*pointer-events:\s*auto/);
  assert.match(baseCss, /\.tutorial-spotlight[\s\S]*pointer-events:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
});

test('BG12J remains presentation-only and does not take rules renderer or BG12K ownership', () => {
  assert.doesNotMatch(css, /Math\.random|dispatchBoardAction|maplibregl|new Map\(/i);
  assert.match(packageDoc, /MapLibre retains map lifecycle, camera, terrain and geographic projection ownership/);
  assert.match(packageDoc, /BG12K general secondary-drawer architecture/);
  assert.doesNotMatch(packageDoc, /new victory|new combat|new movement rule/i);
});

test('BG12J exact-head browser gate measures coach budgets, board visibility and interaction semantics', () => {
  assert.match(capture, /1900, height: 829/);
  assert.match(capture, /1366, height: 768/);
  assert.match(capture, /640, height: 900/);
  assert.match(capture, /maxWidth: 320, maxHeight: 310/);
  assert.match(capture, /maxWidth: 308, maxHeight: 280/);
  assert.match(capture, /spotlightBoxShadow\.includes\('9999px'\)/);
  assert.match(capture, /guidePointerEvents === 'none'/);
  assert.match(capture, /coachPointerEvents === 'auto'/);
  assert.match(capture, /overflow <= 2/);
  assert.match(capture, /\.maplibregl-canvas/);
  assert.match(capture, /Skip tutorial/);
});

test('BG12J workflow validates exact head, legacy tutorial contracts, full regression, build and evidence', () => {
  assert.match(workflow, /BG12J_REF: \$\{\{ github\.event_name == 'pull_request'/);
  assert.match(workflow, /ref: \$\{\{ env\.BG12J_REF \}\}/);
  assert.match(workflow, /tests\/bg12j-coach-mark-onboarding\.test\.cjs/);
  assert.match(workflow, /tests\/dynamic-tutorial\.test\.cjs/);
  assert.match(workflow, /tests\/wp8-guided-help-remediation\.test\.cjs/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /capture-bg12j-coach-mark-onboarding\.mjs/);
  assert.match(workflow, /artifacts\/bg12j/);
});
