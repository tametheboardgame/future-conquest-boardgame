const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = filePath => fs.readFileSync(filePath, 'utf8');

test('terrain has one reusable lazy/prewarm boundary and a cacheable shared manifest', () => {
  const app = read('src/App.tsx');
  const loader = read('src/presentation/r3-terrain-loader.ts');
  const implementation = read('src/components/TerrainMapPrototypeImpl.tsx');
  assert.match(app, /prewarmTerrainMapModule/);
  assert.match(loader, /terrainModulePromise \?\?= import/);
  assert.match(loader, /terrainModulePromise = undefined/);
  assert.match(loader, /TerrainMapModuleHost/);
  assert.match(loader, /onFallback\(`The terrain renderer could not be loaded/);
  assert.match(implementation, /cache: 'default'/);
  assert.match(implementation, /terrainSourcePromise \?\?= resolveTerrainSource/);
  assert.doesNotMatch(implementation, /no-store/);
});

test('redundant zero-opacity relief DEM is gone while mesh and hillshade stay independent', () => {
  const implementation = read('src/components/TerrainMapPrototypeImpl.tsx');
  assert.doesNotMatch(implementation, /r3-wp2b-relief-dem|color-relief-opacity/);
  assert.match(implementation, /'r3-wp2b-terrain-dem': demSource/);
  assert.match(implementation, /'r3-wp2b-hillshade-dem': \{ \.\.\.demSource \}/);
});

test('markers reconcile by stable identity and overlay source updates are isolated', () => {
  const markerWrapper = read('src/presentation/r3-terrain-operational-markers.ts');
  const markerCore = read('src/presentation/r3-terrain-operational-markers-core.ts');
  const implementation = read('src/components/TerrainMapPrototypeImpl.tsx');
  assert.match(markerWrapper, /reconcileCoreTerrainOperationalMarkers/);
  assert.match(markerCore, /priorById/);
  assert.match(markerCore, /buildTerrainOperationalMarkerDescriptors/);
  assert.match(markerCore, /if \(!prior\) return new Marker/);
  assert.doesNotMatch(markerCore, /candidate\.remove\(\)/);
  assert.match(markerCore, /element\.onclick = descriptor\.action/);
  assert.match(markerCore, /return prior/);
  assert.match(implementation, /reconcileTerrainOperationalMarkers/);
  assert.doesNotMatch(implementation, /\[politicalData, frontData, routeData, nodeData\]/);
});

test('exact-head Chromium gate waits for useful paint, completed terrain bodies and repeated timing evidence', () => {
  const probe = read('scripts/run-r3-wp2e-performance.mjs');
  const comparison = read('scripts/compare-r3-wp2e-performance.mjs');
  const workflow = read('.github/workflows/r3-wp2e-performance-gate.yml');
  const implementation = read('src/components/TerrainMapPrototypeImpl.tsx');
  for (const field of ['firstUsefulPaintMs', 'campaignSettledMs', 'campaignToTheatreMs', 'theatreToSelectedMs', 'totalRequests', 'uniqueRequests', 'duplicateRequests', 'transferredBytes']) {
    assert.match(probe, new RegExp(field));
  }
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /github\.event\.pull_request\.base\.sha/);
  assert.match(probe, /R3_WP2E_BUILD_SHA/);
  assert.match(probe, /R3_WP2E_VARIANT/);
  assert.match(probe, /data-status="ready"/);
  assert.match(probe, /data-overlay-lod.*campaign/);
  assert.match(probe, /requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)/);
  assert.match(probe, /animationFramesAfterReady: 2/);
  assert.match(probe, /waitForTerrainSettlement/);
  assert.match(probe, /TERRAIN_QUIET_MS = 500/);
  assert.match(probe, /CAMERA_SETTLE_MINIMUM_MS = 950/);
  assert.match(probe, /inFlightTerrainRequests/);
  assert.match(probe, /page\.on\('requestfinished'/);
  assert.match(probe, /requiresCompletedTerrainBodies: true/);
  assert.match(probe, /minimumElapsed && noTerrainInFlight && terrainQuiet/);
  assert.match(probe, /waitForTerrainSettlement\(before, CAMERA_SETTLE_MINIMUM_MS\)/);
  assert.doesNotMatch(probe, /data-map-idle-at|data-map-moving/);
  assert.match(probe, /startupOutcome/);
  assert.match(probe, /r3-terrain-fallback-notice/);
  assert.match(probe, /process\.exit\(75\)/);
  assert.match(workflow, /for attempt in 1 2/);
  assert.match(workflow, /if \[ \"\$attempt\" -eq 2 \]/);
  assert.match(workflow, /failed once \(exit \$\{status\}\); retrying in a fresh Chromium process/);
  assert.match(workflow, /R3_WP2E_VARIANT: base[\s\S]+R3_WP2E_TILE_CANCELLATION: cancel/);
  assert.match(workflow, /R3_WP2E_TILE_CANCELLATION: cancel/);
  assert.match(workflow, /head-cancel-pending-tiles/);
  assert.match(workflow, /for sample in 1 2 3/);
  assert.match(workflow, /r3-wp2e-performance-base-1\.json,artifacts\/r3-wp2e-performance-base-2\.json,artifacts\/r3-wp2e-performance-base-3\.json/);
  assert.match(workflow, /r3-wp2e-performance-head-1\.json,artifacts\/r3-wp2e-performance-head-2\.json,artifacts\/r3-wp2e-performance-head-3\.json/);
  assert.match(implementation, /cancelPendingTileRequestsWhileZooming: cancelTilesWhileZooming/);
  assert.match(implementation, /presentationProfile === 'compact'[\s\S]+tileCancellationOverride !== 'retain'/);
  assert.doesNotMatch(implementation, /tileCancellationOverride === 'cancel'/);
  assert.doesNotMatch(workflow, /R3_WP2E_TILE_CANCELLATION: retain/);
  assert.doesNotMatch(probe, /process\.env\.GITHUB_SHA/);
  assert.match(comparison, /evidence identity mismatch/);
  assert.match(comparison, /regressionBudgets/);
  assert.match(comparison, /regressionBudget/);
  assert.match(comparison, /maximumHeadValue/);
  assert.match(comparison, /timingMeasurementEpsilonMs = 5/);
  assert.match(comparison, /timingAggregation: 'median'/);
  assert.match(comparison, /networkAggregation: 'median'/);
  assert.match(comparison, /aggregateNetwork/);
  assert.match(comparison, /performance regression budget exceeded/);
  for (const field of ['firstUsefulPaintMs', 'campaignSettledMs', 'campaignToTheatreMs', 'theatreToSelectedMs']) {
    assert.match(comparison, new RegExp(field));
  }
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /pull_request:[\s\S]+paths:[\s\S]+scripts\/compare-r3-wp2e-performance\.mjs/);
});

test('performance comparator absorbs timer-boundary jitter but still fails a material regression', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r3-wp2e-budget-'));
  const comparator = path.resolve('scripts/compare-r3-wp2e-performance.mjs');
  const baseSha = 'base-sha';
  const headSha = 'head-sha';
  const makeEvidence = (variant, buildSha, multiplier = 1) => ({
    variant,
    buildSha,
    timingsMs: {
      firstUsefulPaintMs: 2000 * multiplier,
      campaignSettledMs: 8000 * multiplier,
      campaignToTheatreMs: 2000 * multiplier,
      theatreToSelectedMs: 7000 * multiplier
    },
    terrainNetwork: {
      totalRequests: 70 * multiplier,
      uniqueRequests: 60 * multiplier,
      duplicateRequestCount: 4 * multiplier,
      declaredBytes: 5_500_000 * multiplier,
      transferredBytes: 5_600_000 * multiplier,
      encodedBodyBytes: 5_500_000 * multiplier
    }
  });

  try {
    const basePath = path.join(tempDir, 'base.json');
    const passingHeadPath = path.join(tempDir, 'head-pass.json');
    const boundaryHeadPath = path.join(tempDir, 'head-boundary.json');
    const failingHeadPath = path.join(tempDir, 'head-fail.json');
    const passingOutputPath = path.join(tempDir, 'comparison-pass.json');
    const boundaryOutputPath = path.join(tempDir, 'comparison-boundary.json');
    const failingOutputPath = path.join(tempDir, 'comparison-fail.json');
    fs.writeFileSync(basePath, JSON.stringify(makeEvidence('base', baseSha)));
    fs.writeFileSync(passingHeadPath, JSON.stringify(makeEvidence('head', headSha, 1.05)));
    const boundaryEvidence = makeEvidence('head', headSha);
    boundaryEvidence.timingsMs.campaignToTheatreMs = 3000.5;
    fs.writeFileSync(boundaryHeadPath, JSON.stringify(boundaryEvidence));
    fs.writeFileSync(failingHeadPath, JSON.stringify(makeEvidence('head', headSha, 2)));

    const passing = spawnSync(process.execPath, [comparator, basePath, passingHeadPath, passingOutputPath, baseSha, headSha], { encoding: 'utf8' });
    assert.equal(passing.status, 0, passing.stderr || passing.stdout);
    assert.equal(JSON.parse(fs.readFileSync(passingOutputPath, 'utf8')).regressionBudget.passed, true);

    const boundary = spawnSync(process.execPath, [comparator, basePath, boundaryHeadPath, boundaryOutputPath, baseSha, headSha], { encoding: 'utf8' });
    assert.equal(boundary.status, 0, boundary.stderr || boundary.stdout);
    const boundaryComparison = JSON.parse(fs.readFileSync(boundaryOutputPath, 'utf8'));
    assert.equal(boundaryComparison.regressionBudget.passed, true);
    assert.equal(boundaryComparison.regressionBudget.timingMeasurementEpsilonMs, 5);

    const failing = spawnSync(process.execPath, [comparator, basePath, failingHeadPath, failingOutputPath, baseSha, headSha], { encoding: 'utf8' });
    assert.notEqual(failing.status, 0);
    assert.match(`${failing.stderr}\n${failing.stdout}`, /performance regression budget exceeded/);
    assert.equal(JSON.parse(fs.readFileSync(failingOutputPath, 'utf8')).regressionBudget.passed, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('performance comparator uses repeated-sample medians without hiding persistent timing or network regressions', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r3-wp2e-median-'));
  const comparator = path.resolve('scripts/compare-r3-wp2e-performance.mjs');
  const baseSha = 'base-sha';
  const headSha = 'head-sha';
  const makeEvidence = (variant, buildSha, campaignToTheatreMs, totalRequests = 64, uniqueRequests = 54) => ({
    variant,
    buildSha,
    timingsMs: {
      firstUsefulPaintMs: 36000,
      campaignSettledMs: 37000,
      campaignToTheatreMs,
      theatreToSelectedMs: 9000
    },
    terrainNetwork: {
      totalRequests,
      uniqueRequests,
      duplicateRequestCount: 10,
      declaredBytes: 5_200_000,
      transferredBytes: 5_220_000,
      encodedBodyBytes: 5_200_000
    }
  });
  const write = (name, evidence) => {
    const filePath = path.join(tempDir, name);
    fs.writeFileSync(filePath, JSON.stringify(evidence));
    return filePath;
  };

  try {
    const basePaths = [1000, 1100, 1200].map((value, index) => write(`base-${index}.json`, makeEvidence('base', baseSha, value)));
    const noisyHeadPaths = [
      makeEvidence('head', headSha, 1200, 100, 90),
      makeEvidence('head', headSha, 2900, 65, 55),
      makeEvidence('head', headSha, 1300, 64, 54)
    ].map((evidence, index) => write(`head-noisy-${index}.json`, evidence));
    const slowHeadPaths = [2800, 2900, 3000].map((value, index) => write(`head-slow-${index}.json`, makeEvidence('head', headSha, value)));
    const networkRegressionPaths = [
      makeEvidence('head', headSha, 1200, 90, 80),
      makeEvidence('head', headSha, 1300, 92, 82),
      makeEvidence('head', headSha, 1400, 94, 84)
    ].map((evidence, index) => write(`head-network-${index}.json`, evidence));
    const noisyOutput = path.join(tempDir, 'noisy-output.json');
    const slowOutput = path.join(tempDir, 'slow-output.json');
    const networkOutput = path.join(tempDir, 'network-output.json');

    const noisy = spawnSync(process.execPath, [comparator, basePaths.join(','), noisyHeadPaths.join(','), noisyOutput, baseSha, headSha], { encoding: 'utf8' });
    assert.equal(noisy.status, 0, noisy.stderr || noisy.stdout);
    const noisyComparison = JSON.parse(fs.readFileSync(noisyOutput, 'utf8'));
    assert.equal(noisyComparison.sampling.baseSamples, 3);
    assert.equal(noisyComparison.sampling.headSamples, 3);
    assert.equal(noisyComparison.sampling.timingAggregation, 'median');
    assert.equal(noisyComparison.sampling.networkAggregation, 'median');
    assert.equal(noisyComparison.timingsMs.campaignToTheatreMs.base, 1100);
    assert.equal(noisyComparison.timingsMs.campaignToTheatreMs.head, 1300);
    assert.equal(noisyComparison.terrainNetwork.totalRequests.head, 65);
    assert.equal(noisyComparison.terrainNetwork.uniqueRequests.head, 55);
    assert.deepEqual(noisyComparison.terrainNetwork.uniqueRequests.headSamples, [90, 55, 54]);
    assert.equal(noisyComparison.regressionBudget.passed, true);

    const slow = spawnSync(process.execPath, [comparator, basePaths.join(','), slowHeadPaths.join(','), slowOutput, baseSha, headSha], { encoding: 'utf8' });
    assert.notEqual(slow.status, 0);
    assert.match(`${slow.stderr}\n${slow.stdout}`, /performance regression budget exceeded/);
    const slowComparison = JSON.parse(fs.readFileSync(slowOutput, 'utf8'));
    assert.equal(slowComparison.timingsMs.campaignToTheatreMs.head, 2900);
    assert.equal(slowComparison.regressionBudget.passed, false);

    const networkRegression = spawnSync(process.execPath, [comparator, basePaths.join(','), networkRegressionPaths.join(','), networkOutput, baseSha, headSha], { encoding: 'utf8' });
    assert.notEqual(networkRegression.status, 0);
    assert.match(`${networkRegression.stderr}\n${networkRegression.stdout}`, /terrainNetwork\.(totalRequests|uniqueRequests)/);
    const networkComparison = JSON.parse(fs.readFileSync(networkOutput, 'utf8'));
    assert.equal(networkComparison.terrainNetwork.totalRequests.head, 92);
    assert.equal(networkComparison.terrainNetwork.uniqueRequests.head, 82);
    assert.equal(networkComparison.regressionBudget.passed, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
