import {
  SEAT_IDS,
  type BoardActionResult,
  type BoardCampaignOutcome,
  type BoardCampaignState,
  type BoardGameState,
  type CommandSeat,
  type SeatId
} from './board-state-types';

export const CENTRAL_FRONT_CAMPAIGN_OBJECTIVES = [
  { spaceId: 'FR-02', label: 'Paris' },
  { spaceId: 'BE-01', label: 'Brussels' },
  { spaceId: 'DE-02', label: 'Rhine-Ruhr' }
] as const;

export const CENTRAL_FRONT_BREAKTHROUGH_TARGET = 10;
export const CENTRAL_FRONT_FINAL_OBJECTIVE_TARGET = 2;

export interface BoardCampaignResolution {
  outcome: Exclude<BoardCampaignOutcome, 'in-progress'>;
  reason: string;
}

export interface BoardCampaignPresentation {
  attackerSeatId: SeatId;
  defenderSeatId: SeatId;
  breakthroughPoints: number;
  breakthroughTarget: number;
  objectivesControlled: number;
  objectiveTarget: number;
  outcome: BoardCampaignOutcome;
  outcomeLabel: string;
  shortLabel: string;
  objectiveSummary: string;
  rulesSummary: string;
  reason: string | null;
}

function participatingSeatIds(state: BoardGameState): SeatId[] {
  return SEAT_IDS.filter(id => state.seats[id].participating);
}

function createLazyCampaignState(state: BoardGameState): BoardCampaignState {
  const participants = participatingSeatIds(state);
  if (participants.length < 2) {
    throw new Error('Central Front campaign requires at least two participating command seats.');
  }

  return {
    attackerSeatId: participants[0],
    defenderSeatId: participants[1],
    breakthroughPoints: 0,
    // Existing v3 saves may resume after several completed rounds. Do not
    // retroactively award control points for board positions we did not observe.
    scoredThroughRound: Math.max(0, state.round - 1),
    outcome: 'in-progress',
    resolvedRound: null,
    reason: null
  };
}

/** BG10 migrates existing v3 saves lazily instead of forcing a save reset. */
export function getBoardCampaignState(state: BoardGameState): BoardCampaignState {
  return state.campaign ?? createLazyCampaignState(state);
}

export function getBoardCampaignObjectiveCount(state: BoardGameState, seatId: SeatId): number {
  return CENTRAL_FRONT_CAMPAIGN_OBJECTIVES.filter(objective => state.spaces[objective.spaceId]?.control === seatId).length;
}

export function isBoardCampaignRoundScored(state: BoardGameState): boolean {
  return getBoardCampaignState(state).scoredThroughRound >= state.round;
}

export function isBoardCampaignResolved(state: BoardGameState): boolean {
  return state.campaign?.outcome === 'attacker-victory' || state.campaign?.outcome === 'defender-victory';
}

export function getSuddenBoardCampaignResolution(state: BoardGameState): BoardCampaignResolution | null {
  const campaign = getBoardCampaignState(state);
  if (campaign.outcome !== 'in-progress') return null;

  const attackerHasFormation = Object.values(state.pieces).some(piece =>
    piece.seatId === campaign.attackerSeatId && piece.spaceId !== null
  );
  if (!attackerHasFormation) {
    return {
      outcome: 'defender-victory',
      reason: 'The expedition has been eliminated from the Central Front.'
    };
  }

  const objectivesControlled = getBoardCampaignObjectiveCount(state, campaign.attackerSeatId);
  if (objectivesControlled === CENTRAL_FRONT_CAMPAIGN_OBJECTIVES.length) {
    return {
      outcome: 'attacker-victory',
      reason: 'The expedition controls Paris, Brussels and Rhine-Ruhr: strategic breakthrough achieved.'
    };
  }

  return null;
}

export function shouldResolveBoardCampaign(state: BoardGameState): boolean {
  if (isBoardCampaignResolved(state)) return false;
  if (getSuddenBoardCampaignResolution(state)) return true;
  return state.phase === 'round-end'
    && state.round >= state.roundLimit
    && isBoardCampaignRoundScored(state);
}

/** Adds one breakthrough point for each strategic objective held at round end. */
export function scoreBoardCampaignRound(state: BoardGameState): BoardActionResult {
  if (state.phase !== 'round-end') {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Cannot score campaign objectives during ${state.phase} phase.`
    };
  }

  const campaign = getBoardCampaignState(state);
  if (campaign.outcome !== 'in-progress') {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: 'Campaign is already resolved.'
    };
  }

  if (campaign.scoredThroughRound >= state.round) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: `Round ${state.round} campaign objectives are already scored.`
    };
  }

  const objectivePoints = getBoardCampaignObjectiveCount(state, campaign.attackerSeatId);
  const nextCampaign: BoardCampaignState = {
    ...campaign,
    breakthroughPoints: campaign.breakthroughPoints + objectivePoints,
    scoredThroughRound: state.round
  };

  return {
    state: {
      ...state,
      campaign: nextCampaign
    },
    accepted: true,
    commandActionsSpent: 0,
    reason: `Round ${state.round} scored: expedition holds ${objectivePoints} strategic objective${objectivePoints === 1 ? '' : 's'} and gains ${objectivePoints} breakthrough point${objectivePoints === 1 ? '' : 's'}.`
  };
}

function finalRoundResolution(state: BoardGameState): BoardCampaignResolution {
  const campaign = getBoardCampaignState(state);
  const objectivesControlled = getBoardCampaignObjectiveCount(state, campaign.attackerSeatId);

  if (objectivesControlled >= CENTRAL_FRONT_FINAL_OBJECTIVE_TARGET) {
    return {
      outcome: 'attacker-victory',
      reason: `The expedition holds ${objectivesControlled} of 3 strategic objectives at the end of round ${state.roundLimit}.`
    };
  }

  if (campaign.breakthroughPoints >= CENTRAL_FRONT_BREAKTHROUGH_TARGET && objectivesControlled >= 1) {
    return {
      outcome: 'attacker-victory',
      reason: `Sustained pressure reached ${campaign.breakthroughPoints} breakthrough points and the expedition still holds a strategic objective.`
    };
  }

  return {
    outcome: 'defender-victory',
    reason: `The defenders prevented a decisive breakthrough through round ${state.roundLimit}.`
  };
}

/** Free authoritative terminal action. No board action may continue afterwards. */
export function resolveBoardCampaign(state: BoardGameState): BoardActionResult {
  const campaign = getBoardCampaignState(state);
  if (campaign.outcome !== 'in-progress') {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: 'Campaign is already resolved.'
    };
  }

  let resolution = getSuddenBoardCampaignResolution(state);
  if (!resolution) {
    if (state.phase !== 'round-end') {
      return {
        state,
        accepted: false,
        commandActionsSpent: 0,
        reason: 'Campaign can only resolve early after a sudden victory or defeat condition.'
      };
    }
    if (state.round < state.roundLimit) {
      return {
        state,
        accepted: false,
        commandActionsSpent: 0,
        reason: `Campaign cannot resolve normally before round ${state.roundLimit}.`
      };
    }
    if (!isBoardCampaignRoundScored(state)) {
      return {
        state,
        accepted: false,
        commandActionsSpent: 0,
        reason: `Round ${state.round} must be scored before final campaign resolution.`
      };
    }
    resolution = finalRoundResolution(state);
  }

  const seats = Object.fromEntries(SEAT_IDS.map(id => [id, {
    ...state.seats[id],
    commandActionsRemaining: 0
  }])) as Record<SeatId, CommandSeat>;

  return {
    state: {
      ...state,
      phase: 'round-end',
      seats,
      campaign: {
        ...campaign,
        outcome: resolution.outcome,
        resolvedRound: state.round,
        reason: resolution.reason
      }
    },
    accepted: true,
    commandActionsSpent: 0,
    reason: resolution.reason
  };
}

export function projectBoardCampaignStatus(state: BoardGameState): BoardCampaignPresentation {
  const campaign = getBoardCampaignState(state);
  const objectivesControlled = getBoardCampaignObjectiveCount(state, campaign.attackerSeatId);
  const objectiveSummary = CENTRAL_FRONT_CAMPAIGN_OBJECTIVES.map(objective => {
    const holder = state.spaces[objective.spaceId]?.control;
    const stateLabel = holder === campaign.attackerSeatId ? 'Expedition' : holder === campaign.defenderSeatId ? 'Defenders' : 'Uncontrolled';
    return `${objective.label}: ${stateLabel}`;
  }).join(' · ');

  const outcomeLabel = campaign.outcome === 'attacker-victory'
    ? 'Expedition victory'
    : campaign.outcome === 'defender-victory'
      ? 'Defender victory'
      : 'Campaign in progress';

  return {
    attackerSeatId: campaign.attackerSeatId,
    defenderSeatId: campaign.defenderSeatId,
    breakthroughPoints: campaign.breakthroughPoints,
    breakthroughTarget: CENTRAL_FRONT_BREAKTHROUGH_TARGET,
    objectivesControlled,
    objectiveTarget: CENTRAL_FRONT_CAMPAIGN_OBJECTIVES.length,
    outcome: campaign.outcome,
    outcomeLabel,
    shortLabel: `${objectivesControlled}/3 · ${campaign.breakthroughPoints}/${CENTRAL_FRONT_BREAKTHROUGH_TARGET} BP`,
    objectiveSummary,
    rulesSummary: 'Expedition: hold all 3 objectives immediately, or finish round 8 holding 2; 10 breakthrough points also win if an objective remains held. Defenders win by eliminating the expedition or preventing those conditions.',
    reason: campaign.reason
  };
}