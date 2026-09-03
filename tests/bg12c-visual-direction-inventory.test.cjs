const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const inventory = JSON.parse(read('docs/bg12c-ui-inventory.json'));

const allowedClassifications = new Set(['KEEP', 'TRANSFORM', 'COLLAPSE', 'RETIRE', 'DEBUG-ONLY']);

function surface(id) {
  const item = inventory.surfaces.find(candidate => candidate.id === id);
  assert.ok(item, `BG12C inventory is missing ${id}`);
  return item;
}

function assertStack(file, selector, zIndex) {
  const source = read(file);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(source, new RegExp(`${escaped}\\s*\\{[\\s\\S]*?z-index:\\s*${zIndex};`), `${selector} z-index audit drifted`);
}

test('BG12C inventory is complete, uniquely identified and uses only locked classifications', () => {
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.package, 'BG12C');
  assert.ok(inventory.surfaces.length >= 25, `expected a full normal-play inventory, got ${inventory.surfaces.length}`);

  const ids = inventory.surfaces.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'surface ids must be unique');

  for (const item of inventory.surfaces) {
    assert.ok(allowedClassifications.has(item.classification), `${item.id} has invalid classification ${item.classification}`);
    for (const key of ['owner', 'currentPurpose', 'target', 'migrationPackage', 'finalRemoval', 'normalPlayAfterBG12D', 'reason']) {
      assert.equal(typeof item[key], 'string', `${item.id}.${key} must be documented`);
      assert.ok(item[key].trim().length > 0, `${item.id}.${key} must not be empty`);
    }
  }

  for (const classification of allowedClassifications) {
    assert.ok(inventory.surfaces.some(item => item.classification === classification), `inventory has no ${classification} surface`);
  }
});

test('BG12C locks the tabletop-first surface budget and diagnostics route', () => {
  assert.deepEqual(inventory.visualDirection.mapAttentionTargetPercent, [80, 90]);
  assert.deepEqual(inventory.visualDirection.normalPlayPersistentSurfaces, [
    'thin-status-strip',
    'minimal-navigation',
    'tabletop-rail'
  ]);
  assert.equal(inventory.visualDirection.maxContextualSurfaces, 1);
  assert.equal(inventory.visualDirection.maxTransientCoachMarks, 1);
  assert.equal(inventory.visualDirection.diagnosticsQuery, '?legacy-ui=1');

  assert.equal(inventory.surfaceBudgets.desktop.maxPersistentChromeSurfaces, 3);
  assert.equal(inventory.surfaceBudgets.desktop.maxContextualSurfaces, 1);
  assert.equal(inventory.surfaceBudgets.desktop.statusStripMaxHeightPx, 48);
  assert.equal(inventory.surfaceBudgets.desktop.navigationMaxWidthPx, 72);
  assert.equal(inventory.surfaceBudgets.desktop.tabletopRailMaxWidthPx, 320);
  assert.ok(inventory.surfaceBudgets.desktop.idleMapMinViewportWidthPercent >= 70);

  assert.equal(inventory.surfaceBudgets.compact.tabletopRailCollapsedByDefault, true);
  assert.equal(inventory.surfaceBudgets.compact.maxContextualSurfaces, 1);
  assert.ok(inventory.surfaceBudgets.compact.idleMapMinViewportHeightPercent >= 60);

  assert.deepEqual(
    inventory.browserAcceptance.viewports.map(({ width, height }) => `${width}x${height}`),
    ['1900x829', '1366x768', '640x900']
  );
});

test('BG12C gives every currently dominant board surface a destination and package', () => {
  assert.equal(surface('board-map').classification, 'KEEP');
  assert.equal(surface('physical-formations').classification, 'KEEP');
  assert.equal(surface('tabletop-status-shell').classification, 'TRANSFORM');
  assert.equal(surface('tabletop-card-hand').migrationPackage, 'BG12F');
  assert.equal(surface('tabletop-combat-panel').migrationPackage, 'BG12G/BG12H');
  assert.equal(surface('tabletop-activation-panel').migrationPackage, 'BG12H');
  assert.equal(surface('tabletop-support-panel').migrationPackage, 'BG12H');
  assert.equal(surface('tabletop-onboarding').migrationPackage, 'BG12J');
  assert.equal(surface('tabletop-rules-reference').migrationPackage, 'BG12K');
  assert.equal(surface('global-settings').migrationPackage, 'BG12K');

  for (const id of [
    'legacy-more-gateway',
    'legacy-regions-workspace',
    'legacy-engineer-workspace',
    'legacy-logistics-workspace',
    'legacy-intelligence-workspace',
    'legacy-operations-workspace'
  ]) {
    assert.equal(surface(id).normalPlayAfterBG12D, 'hidden', `${id} must leave normal play in BG12D`);
  }
});

test('BG12C records the pre-BG12E collision-prone overlay stack from the owning CSS', () => {
  assertStack('src/components/tabletop-rules-reference.css', '.tabletop-context-hint', 31);
  assertStack('src/components/tabletop-card-hand.css', '.tabletop-card-hand', 34);
  assertStack('src/bg1-current-activation.css', '.tabletop-activation-panel', 34);
  assertStack('src/bg5-dice-combat.css', '.tabletop-combat-panel', 34);
  assertStack('src/components/tabletop-support.css', '.tabletop-support-panel', 34);
  assertStack('src/bg1-boardgame-shell.css', '.command-app-shell > .command-topbar', 36);
  assertStack('src/components/tabletop-rules-reference.css', '.tabletop-rules-button', 72);
  assertStack('src/components/tabletop-onboarding.css', '.tabletop-guide-button', 72);
  assertStack('src/components/tabletop-rules-reference.css', '.tabletop-rules-reference', 73);
  assertStack('src/components/tabletop-onboarding.css', '.tabletop-onboarding-card', 74);

  const audited = new Map(inventory.knownOverlayStack.map(item => [item.surface, item.zIndex]));
  assert.equal(audited.get('tabletop-context-hint'), 31);
  assert.equal(audited.get('tabletop-card-hand'), 34);
  assert.equal(audited.get('tabletop-activation-panel'), 34);
  assert.equal(audited.get('tabletop-combat-panel'), 34);
  assert.equal(audited.get('tabletop-support-panel'), 34);
  assert.equal(audited.get('legacy-command-topbar'), 36);
  assert.equal(audited.get('tabletop-rules-reference'), 73);
  assert.equal(audited.get('tabletop-onboarding-card'), 74);
});

test('BG12C transitional root ownership has advanced into the BG12E layout owner', () => {
  const main = read('src/main.tsx');
  assert.match(main, /<TabletopLayout>[\s\S]*?<App \/>[\s\S]*?<\/TabletopLayout>/);
  assert.doesNotMatch(main, /<TabletopStatusShell \/>/);
  assert.doesNotMatch(main, /<TabletopCombatPanel \/>/);
  assert.doesNotMatch(main, /<TabletopActivationPanel \/>/);

  const layout = read('src/components/TabletopLayout.tsx');
  for (const child of [
    'TabletopStatusShell',
    'TabletopContextHint',
    'TabletopCardHandPanel',
    'TabletopSupportPanel',
    'TabletopPassReason',
    'TabletopRulesReference',
    'TabletopOnboarding',
    'TabletopCombatPanel',
    'TabletopActivationPanel'
  ]) {
    assert.match(layout, new RegExp(`<${child}(?:\\s|\\/)`), `BG12E layout no longer owns ${child}; refresh composition contract`);
  }

  const shell = read('src/components/TabletopStatusShell.tsx');
  for (const child of [
    'TabletopContextHint',
    'TabletopCardHandPanel',
    'TabletopSupportPanel',
    'TabletopPassReason',
    'TabletopRulesReference',
    'TabletopOnboarding'
  ]) {
    assert.doesNotMatch(shell, new RegExp(`<${child}\\s*/>`), `status strip must not resume overlay ownership of ${child}`);
  }
});

test('BG12C explicitly quarantines historical probes that still depend on legacy workspaces', () => {
  const navigation = read('src/components/CommandNavigation.tsx');
  for (const view of ['territories', 'engineering', 'logistics', 'intelligence']) {
    assert.match(navigation, new RegExp(`id: '${view}'`), `legacy ${view} route no longer exists; refresh quarantine plan`);
  }
  assert.match(navigation, /command-nav-legacy/);

  const workflow = read('.github/workflows/r3-wp9-integrated-validation.yml');
  assert.match(workflow, /Adapt historical browser probes to explicit BG12D diagnostics mode/);
  assert.match(workflow, /legacy-ui=1/);
  assert.match(workflow, /probe-r3-wp6-command-ui\.mjs/);
  assert.match(workflow, /probe-r3-wp6-5-interface-polish\.mjs/);

  const dependencies = new Set(inventory.legacyProbeDependencies.map(item => item.script));
  assert.ok(dependencies.has('scripts/probe-r3-wp6-command-ui.mjs'));
  assert.ok(dependencies.has('scripts/probe-r3-wp6-5-interface-polish.mjs'));
  assert.ok(inventory.legacyProbeDependencies.every(item => item.migration.includes('?legacy-ui=1')));
});

test('BG12C protects the board-game rules and renderer boundary in the acceptance contract', () => {
  const protectedInfrastructure = inventory.visualDirection.protectedInfrastructure.join('\n');
  assert.match(protectedInfrastructure, /MapLibre\/WebGL lifecycle/);
  assert.match(protectedInfrastructure, /retained physical formation rendering/);
  assert.match(protectedInfrastructure, /authoritative board state and dispatcher/);
  assert.match(protectedInfrastructure, /deterministic save\/reload/);

  assert.ok(inventory.browserAcceptance.normalPlayAssertions.some(value => value.includes('At most one contextual interaction surface')));
  assert.ok(inventory.browserAcceptance.normalPlayAssertions.some(value => value.includes('no legacy operational workspace')));
  assert.ok(inventory.browserAcceptance.diagnosticsAssertions.some(value => value.includes('?legacy-ui=1')));
});
