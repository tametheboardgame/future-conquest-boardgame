import fs from 'node:fs';

const [basePathSpec, headPathSpec, outputPath, expectedBaseSha, expectedHeadSha] = process.argv.slice(2);
if (![basePathSpec, headPathSpec, outputPath, expectedBaseSha, expectedHeadSha].every(Boolean)) {
  throw new Error('usage: compare-r3-wp2e-performance.mjs BASE[,BASE...] HEAD[,HEAD...] OUTPUT EXPECTED_BASE_SHA EXPECTED_HEAD_SHA');
}

const timingFields = ['firstUsefulPaintMs', 'campaignSettledMs', 'campaignToTheatreMs', 'theatreToSelectedMs'];
const networkFields = ['totalRequests', 'uniqueRequests', 'duplicateRequestCount', 'declaredBytes', 'transferredBytes', 'encodedBodyBytes'];

const readEvidenceSet = pathSpec => pathSpec.split(',').map(filePath => JSON.parse(fs.readFileSync(filePath, 'utf8')));
const assertIdentity = (evidence, variant, buildSha) => {
  if (evidence.variant !== variant || evidence.buildSha !== buildSha) {
    throw new Error(`${variant} evidence identity mismatch: expected ${buildSha}, got ${evidence.variant}:${evidence.buildSha}`);
  }
};
const median = values => {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const aggregateTimings = evidenceSet => Object.fromEntries(timingFields.map(field => {
  const values = evidenceSet.map(evidence => evidence.timingsMs[field]);
  if (!values.every(Number.isFinite)) throw new Error(`performance evidence missing numeric timingsMs.${field}`);
  return [field, median(values)];
}));

const baseSamples = readEvidenceSet(basePathSpec);
const headSamples = readEvidenceSet(headPathSpec);
if (baseSamples.length < 1 || headSamples.length < 1) throw new Error('performance evidence set must contain at least one base and head sample');
baseSamples.forEach(evidence => assertIdentity(evidence, 'base', expectedBaseSha));
headSamples.forEach(evidence => assertIdentity(evidence, 'head', expectedHeadSha));

// Timing metrics are scheduler-sensitive on shared runners. Compare medians when
// repeated samples are supplied, while retaining the first exact sample for all
// network/payload checks so the existing non-timing guardrails are unchanged.
const base = {
  ...baseSamples[0],
  timingsMs: aggregateTimings(baseSamples)
};
const head = {
  ...headSamples[0],
  timingsMs: aggregateTimings(headSamples)
};

// These are regression guardrails, not optimisation targets. The relative and
// absolute tolerances deliberately absorb normal shared-runner variance while
// ensuring that a materially slower/heavier terrain renderer cannot stay green.
const regressionBudgets = [
  { group: 'timingsMs', field: 'firstUsefulPaintMs', relativeTolerance: 0.35, absoluteTolerance: 1000 },
  { group: 'timingsMs', field: 'campaignSettledMs', relativeTolerance: 0.30, absoluteTolerance: 2500 },
  { group: 'timingsMs', field: 'campaignToTheatreMs', relativeTolerance: 0.50, absoluteTolerance: 1000 },
  { group: 'timingsMs', field: 'theatreToSelectedMs', relativeTolerance: 0.30, absoluteTolerance: 2500 },
  { group: 'terrainNetwork', field: 'totalRequests', relativeTolerance: 0.20, absoluteTolerance: 10 },
  { group: 'terrainNetwork', field: 'uniqueRequests', relativeTolerance: 0.20, absoluteTolerance: 10 },
  { group: 'terrainNetwork', field: 'duplicateRequestCount', relativeTolerance: 1.00, absoluteTolerance: 10 },
  { group: 'terrainNetwork', field: 'transferredBytes', relativeTolerance: 0.20, absoluteTolerance: 1_048_576 }
];

// Performance.now() is sub-millisecond, but shared-runner scheduling is not.
// Keep a tiny fixed epsilon only for timing comparisons so a 0.x ms boundary
// crossing cannot turn an otherwise healthy run red. This does not alter the
// substantive relative/absolute regression budgets above.
const timingMeasurementEpsilonMs = 5;

const budgetChecks = regressionBudgets.map(budget => {
  const baseValue = base[budget.group][budget.field];
  const headValue = head[budget.group][budget.field];
  if (!Number.isFinite(baseValue) || !Number.isFinite(headValue)) {
    throw new Error(`performance evidence missing numeric ${budget.group}.${budget.field}`);
  }
  const allowedIncrease = Math.max(baseValue * budget.relativeTolerance, budget.absoluteTolerance);
  const measurementEpsilon = budget.group === 'timingsMs' ? timingMeasurementEpsilonMs : 0;
  const maximumHeadValue = baseValue + allowedIncrease + measurementEpsilon;
  return {
    ...budget,
    measurementEpsilon,
    base: baseValue,
    head: headValue,
    maximumHeadValue,
    passed: headValue <= maximumHeadValue
  };
});
const failedBudgetChecks = budgetChecks.filter(check => !check.passed);

const comparison = {
  schemaVersion: 2,
  identities: {
    base: { variant: base.variant, buildSha: base.buildSha },
    head: { variant: head.variant, buildSha: head.buildSha }
  },
  sampling: {
    baseSamples: baseSamples.length,
    headSamples: headSamples.length,
    timingAggregation: 'median',
    networkAggregation: 'first-exact-sample'
  },
  timingsMs: Object.fromEntries(timingFields.map(field => [field, {
    base: base.timingsMs[field], head: head.timingsMs[field], delta: head.timingsMs[field] - base.timingsMs[field],
    baseSamples: baseSamples.map(evidence => evidence.timingsMs[field]),
    headSamples: headSamples.map(evidence => evidence.timingsMs[field])
  }])),
  terrainNetwork: Object.fromEntries(networkFields.map(field => [field, {
    base: base.terrainNetwork[field], head: head.terrainNetwork[field], delta: head.terrainNetwork[field] - base.terrainNetwork[field]
  }])),
  regressionBudget: {
    passed: failedBudgetChecks.length === 0,
    timingMeasurementEpsilonMs,
    checks: budgetChecks
  }
};
fs.writeFileSync(outputPath, `${JSON.stringify(comparison, null, 2)}\n`);
console.log(JSON.stringify(comparison, null, 2));

if (failedBudgetChecks.length > 0) {
  const failures = failedBudgetChecks
    .map(check => `${check.group}.${check.field}=${check.head} exceeds ${check.maximumHeadValue} (base ${check.base})`)
    .join('; ');
  throw new Error(`WP2E performance regression budget exceeded: ${failures}`);
}
