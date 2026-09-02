import {
  getBoardCampaignObjectiveCount,
  getBoardCampaignState,
  isBoardCampaignResolved
} from './board-campaign';
import { applyBoardAction } from './board-action-dispatcher';
import { createInitialBoardState } from './board-state';
import { chooseAutomaticBoardAction } from './board-turn-orchestration';
import type { BoardCampaignOutcome, BoardGameState, SeatId } from './board-state-types';

export interface BoardPlaytestOptions {
  runs: number;
  seedOffset?: number;
  maxSteps?: number;
}

export interface BoardPlaytestCampaignResult {
  seed: number;
  startingAttackerSpaceId: string | null;
  outcome: BoardCampaignOutcome | 'stalled' | 'rejected-action' | 'safety-limit';
  resolvedRound: number | null;
  resolutionKind: 'sudden' | 'final-round' | 'unresolved';
  reason: string;
  steps: number;
  rngCalls: number;
  breakthroughPoints: number;
  attackerObjectives: number;
  attackerPiecesRemaining: number;
  defenderPiecesRemaining: number;
  totalDamage: number;
  actionCounts: Record<string, number>;
}

export interface BoardPlaytestMatrixReport {
  boardStateVersion: number;
  options: {
    runs: number;
    seedOffset: number;
    maxSteps: number;
  };
  campaigns: number;
  resolvedCampaigns: number;
  attackerWins: number;
  defenderWins: number;
  unresolvedCampaigns: number;
  rejectedCampaigns: number;
  safetyLimitCampaigns: number;
  attackerWinRate: number;
  defenderWinRate: number;
  medianResolutionRound: number | null;
  averageSteps: number;
  totalActions: Record<string, number>;
  balanceSignal: 'inconclusive' | 'attacker-dominant' | 'defender-dominant' | 'mixed';
  integrityGate: 'pass' | 'fail';
  findings: string[];
  results: BoardPlaytestCampaignResult[];
}

const DEFAULT_MAX_STEPS = 1000;
const MIN_BALANCE_SAMPLE = 12;
const DOMINANCE_THRESHOLD = 0.85;

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

function survivingPieces(state: BoardGameState, seatId: SeatId): number {
  return Object.values(state.pieces).filter(piece => piece.seatId === seatId && piece.spaceId !== null).length;
}

function totalDamage(state: BoardGameState): number {
  return Object.values(state.pieces).reduce((sum, piece) => sum + piece.damage, 0);
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Runs one production-rules computer-v-computer board campaign. Every step is
 * selected by the same automatic orchestration used by BoardGameStateProvider
 * and resolved through the same unified dispatcher used by human play.
 */
export function simulateBoardPlaytestCampaign(seed: number, maxSteps = DEFAULT_MAX_STEPS): BoardPlaytestCampaignResult {
  positiveInteger(maxSteps, 'maxSteps');
  let state = createInitialBoardState({
    seed,
    controllers: { 'seat-1': 'computer', 'seat-2': 'computer' }
  });
  const initialCampaign = getBoardCampaignState(state);
  const startingAttackerSpaceId = Object.values(state.pieces)
    .filter(piece => piece.seatId === initialCampaign.attackerSeatId && piece.spaceId !== null)
    .sort((a, b) => a.id.localeCompare(b.id))[0]?.spaceId ?? null;
  const actionCounts: Record<string, number> = {};
  let steps = 0;
  let failure: BoardPlaytestCampaignResult['outcome'] | null = null;
  let failureReason = '';

  while (!isBoardCampaignResolved(state) && steps < maxSteps) {
    const action = chooseAutomaticBoardAction(state);
    if (!action) {
      failure = 'stalled';
      failureReason = `No automatic action available during round ${state.round} ${state.phase}.`;
      break;
    }

    const result = applyBoardAction(state, action);
    increment(actionCounts, action.type);
    steps += 1;
    if (!result.accepted) {
      failure = 'rejected-action';
      failureReason = `${action.type} rejected at step ${steps}: ${result.reason}`;
      break;
    }
    state = result.state;
  }

  if (!failure && !isBoardCampaignResolved(state)) {
    failure = 'safety-limit';
    failureReason = `Campaign exceeded ${maxSteps} automatic actions without resolving.`;
  }

  const campaign = getBoardCampaignState(state);
  const resolved = isBoardCampaignResolved(state);
  const outcome = failure ?? campaign.outcome;
  const reason = failureReason || campaign.reason || 'Campaign remains unresolved.';
  const resolvedRound = resolved ? campaign.resolvedRound : null;

  return {
    seed,
    startingAttackerSpaceId,
    outcome,
    resolvedRound,
    resolutionKind: resolvedRound === null
      ? 'unresolved'
      : resolvedRound < state.roundLimit ? 'sudden' : 'final-round',
    reason,
    steps,
    rngCalls: state.rng.calls,
    breakthroughPoints: campaign.breakthroughPoints,
    attackerObjectives: getBoardCampaignObjectiveCount(state, campaign.attackerSeatId),
    attackerPiecesRemaining: survivingPieces(state, campaign.attackerSeatId),
    defenderPiecesRemaining: survivingPieces(state, campaign.defenderSeatId),
    totalDamage: totalDamage(state),
    actionCounts
  };
}

function aggregateActions(results: readonly BoardPlaytestCampaignResult[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const result of results) {
    for (const [action, count] of Object.entries(result.actionCounts)) total[action] = (total[action] ?? 0) + count;
  }
  return Object.fromEntries(Object.entries(total).sort(([a], [b]) => a.localeCompare(b)));
}

function deriveBalanceSignal(campaigns: number, attackerWinRate: number, defenderWinRate: number): BoardPlaytestMatrixReport['balanceSignal'] {
  if (campaigns < MIN_BALANCE_SAMPLE) return 'inconclusive';
  if (attackerWinRate >= DOMINANCE_THRESHOLD) return 'attacker-dominant';
  if (defenderWinRate >= DOMINANCE_THRESHOLD) return 'defender-dominant';
  return 'mixed';
}

export function runBoardPlaytestMatrix(options: BoardPlaytestOptions): BoardPlaytestMatrixReport {
  const runs = positiveInteger(options.runs, 'runs');
  const seedOffset = nonNegativeInteger(options.seedOffset ?? 1, 'seedOffset');
  const maxSteps = positiveInteger(options.maxSteps ?? DEFAULT_MAX_STEPS, 'maxSteps');
  const results = Array.from({ length: runs }, (_, index) =>
    simulateBoardPlaytestCampaign(seedOffset + index, maxSteps));

  const attackerWins = results.filter(result => result.outcome === 'attacker-victory').length;
  const defenderWins = results.filter(result => result.outcome === 'defender-victory').length;
  const resolvedCampaigns = attackerWins + defenderWins;
  const rejectedCampaigns = results.filter(result => result.outcome === 'rejected-action').length;
  const safetyLimitCampaigns = results.filter(result => result.outcome === 'safety-limit').length;
  const unresolvedCampaigns = results.length - resolvedCampaigns;
  const attackerWinRate = resolvedCampaigns > 0 ? attackerWins / resolvedCampaigns : 0;
  const defenderWinRate = resolvedCampaigns > 0 ? defenderWins / resolvedCampaigns : 0;
  const balanceSignal = deriveBalanceSignal(results.length, attackerWinRate, defenderWinRate);
  const findings: string[] = [];

  if (unresolvedCampaigns > 0) findings.push(`${unresolvedCampaigns} campaign(s) did not resolve cleanly.`);
  if (rejectedCampaigns > 0) findings.push(`${rejectedCampaigns} campaign(s) hit a rejected automatic action.`);
  if (safetyLimitCampaigns > 0) findings.push(`${safetyLimitCampaigns} campaign(s) hit the automatic-action safety limit.`);
  if (balanceSignal === 'attacker-dominant') findings.push(`Attacker won ${percent(attackerWinRate)} of resolved campaigns; investigate a dominant expedition strategy.`);
  if (balanceSignal === 'defender-dominant') findings.push(`Defender won ${percent(defenderWinRate)} of resolved campaigns; investigate unwinnable expedition openings.`);
  if (balanceSignal === 'mixed') findings.push('No side crossed the initial 85% dominance signal in this automated sample.');
  if (balanceSignal === 'inconclusive') findings.push(`Run at least ${MIN_BALANCE_SAMPLE} campaigns before interpreting the balance split.`);

  return {
    boardStateVersion: 3,
    options: { runs, seedOffset, maxSteps },
    campaigns: results.length,
    resolvedCampaigns,
    attackerWins,
    defenderWins,
    unresolvedCampaigns,
    rejectedCampaigns,
    safetyLimitCampaigns,
    attackerWinRate,
    defenderWinRate,
    medianResolutionRound: median(results
      .map(result => result.resolvedRound)
      .filter((round): round is number => round !== null)),
    averageSteps: results.reduce((sum, result) => sum + result.steps, 0) / results.length,
    totalActions: aggregateActions(results),
    balanceSignal,
    integrityGate: unresolvedCampaigns === 0 && rejectedCampaigns === 0 && safetyLimitCampaigns === 0 ? 'pass' : 'fail',
    findings,
    results
  };
}

export function renderBoardPlaytestMatrixMarkdown(report: BoardPlaytestMatrixReport): string {
  const lines = [
    '# Future Conquest board playtest matrix',
    '',
    `- Campaigns: ${report.campaigns}`,
    `- Integrity gate: **${report.integrityGate.toUpperCase()}**`,
    `- Resolved: ${report.resolvedCampaigns}/${report.campaigns}`,
    `- Expedition wins: ${report.attackerWins} (${percent(report.attackerWinRate)})`,
    `- Defender wins: ${report.defenderWins} (${percent(report.defenderWinRate)})`,
    `- Median resolution round: ${report.medianResolutionRound ?? 'n/a'}`,
    `- Average automatic actions: ${report.averageSteps.toFixed(1)}`,
    `- Balance signal: **${report.balanceSignal}**`,
    '',
    '## Findings',
    '',
    ...report.findings.map(finding => `- ${finding}`),
    '',
    '## Action mix',
    '',
    ...Object.entries(report.totalActions).map(([action, count]) => `- ${action}: ${count}`),
    '',
    '## Campaigns',
    '',
    '| Seed | Start | Outcome | Round | BP | Objectives | Steps |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: |',
    ...report.results.map(result => `| ${result.seed} | ${result.startingAttackerSpaceId ?? 'n/a'} | ${result.outcome} | ${result.resolvedRound ?? '-'} | ${result.breakthroughPoints} | ${result.attackerObjectives} | ${result.steps} |`),
    ''
  ];
  return `${lines.join('\n')}\n`;
}
