import { TERRITORIES } from './data';
import {
  getNextActivatingSeatId,
  nextBoardRandom
} from './board-state';
import type {
  BoardActionResult,
  BoardCombatModifiers,
  BoardCombatState,
  BoardGameState,
  BoardPiece,
  BoardSpace,
  SupplyState
} from './board-state-types';
import type { Terrain } from './types';

export const BOARD_COMBAT_DIE_COUNT = 1 as const;
export const BOARD_COMBAT_DIE_SIDES = 20 as const;
export const BOARD_COMBAT_BASE_TARGET = 11 as const;

const TERRAIN_DEFENCE_MODIFIER: Record<Terrain, number> = {
  'open-lowland': 0,
  'mixed-lowland': 1,
  'mixed-upland': 2,
  mountainous: 3
};

const SUPPLY_ATTACK_MODIFIER: Record<SupplyState, number> = {
  supplied: 0,
  strained: -1,
  isolated: -2
};

export type BoardCombatPreview =
  | {
      legal: false;
      reason: string;
      attackerPieceId: string;
      defenderPieceId: string;
    }
  | {
      legal: true;
      reason: null;
      attackerPieceId: string;
      defenderPieceId: string;
      originSpaceId: string;
      targetSpaceId: string;
      dieCount: typeof BOARD_COMBAT_DIE_COUNT;
      dieSides: typeof BOARD_COMBAT_DIE_SIDES;
      baseTarget: typeof BOARD_COMBAT_BASE_TARGET;
      modifiers: BoardCombatModifiers;
      attackModifier: number;
      defenceModifier: number;
      target: number;
    };

function getFortificationModifier(space: BoardSpace): number {
  const value = space.fortification ?? 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function getTerrainModifier(spaceId: string): number {
  const territory = TERRITORIES[spaceId];
  return territory ? TERRAIN_DEFENCE_MODIFIER[territory.terrain] : 0;
}

function getCombatLegalityReason(
  state: BoardGameState,
  attackerPieceId: string,
  defenderPieceId: string,
  ignorePendingCombat = false
): string | null {
  if (state.phase !== 'activation') {
    return `Cannot declare combat during ${state.phase} phase.`;
  }

  if (!ignorePendingCombat && state.combat?.status === 'declared') {
    return 'Resolve the currently declared combat before declaring another attack.';
  }

  const activeSeat = state.seats[state.activeSeat];
  if (!activeSeat.participating || activeSeat.commandActionsRemaining <= 0) {
    return `${state.activeSeat} has no Command Actions remaining.`;
  }

  const attacker = state.pieces[attackerPieceId];
  if (!attacker) return `Unknown attacking board piece: ${attackerPieceId}.`;
  if (attacker.seatId !== state.activeSeat) {
    return `${attackerPieceId} is owned by ${attacker.seatId}, not active seat ${state.activeSeat}.`;
  }
  if (!attacker.spaceId) return `${attackerPieceId} is not currently on a board space.`;

  const defender = state.pieces[defenderPieceId];
  if (!defender) return `Unknown defending board piece: ${defenderPieceId}.`;
  if (defender.seatId === attacker.seatId) {
    return `${defenderPieceId} is friendly to ${attackerPieceId}.`;
  }
  if (!defender.spaceId) return `${defenderPieceId} is not currently on a board space.`;

  const origin = state.spaces[attacker.spaceId];
  if (!origin) return `${attackerPieceId} has an invalid current board space.`;
  if (!state.spaces[defender.spaceId]) return `${defenderPieceId} has an invalid current board space.`;
  if (!origin.adjacentSpaceIds.includes(defender.spaceId)) {
    return `${defenderPieceId} is not in a space adjacent to ${attackerPieceId}.`;
  }

  return null;
}

function buildLegalPreview(
  state: BoardGameState,
  attacker: BoardPiece,
  defender: BoardPiece
): Extract<BoardCombatPreview, { legal: true }> {
  const originSpaceId = attacker.spaceId as string;
  const targetSpaceId = defender.spaceId as string;
  const targetSpace = state.spaces[targetSpaceId];
  const modifiers: BoardCombatModifiers = {
    supply: SUPPLY_ATTACK_MODIFIER[attacker.supply],
    terrain: getTerrainModifier(targetSpaceId),
    fortification: getFortificationModifier(targetSpace)
  };
  const attackModifier = modifiers.supply;
  const defenceModifier = modifiers.terrain + modifiers.fortification;

  return {
    legal: true,
    reason: null,
    attackerPieceId: attacker.id,
    defenderPieceId: defender.id,
    originSpaceId,
    targetSpaceId,
    dieCount: BOARD_COMBAT_DIE_COUNT,
    dieSides: BOARD_COMBAT_DIE_SIDES,
    baseTarget: BOARD_COMBAT_BASE_TARGET,
    modifiers,
    attackModifier,
    defenceModifier,
    target: BOARD_COMBAT_BASE_TARGET + defenceModifier
  };
}

/**
 * Returns the exact seeded-dice contract the UI can show before commitment.
 * BG5 presentation must consume this preview rather than recreating combat rules.
 */
export function getBoardCombatPreview(
  state: BoardGameState,
  attackerPieceId: string,
  defenderPieceId: string
): BoardCombatPreview {
  const reason = getCombatLegalityReason(state, attackerPieceId, defenderPieceId);
  if (reason) {
    return {
      legal: false,
      reason,
      attackerPieceId,
      defenderPieceId
    };
  }

  return buildLegalPreview(
    state,
    state.pieces[attackerPieceId],
    state.pieces[defenderPieceId]
  );
}

/**
 * Locks a legal attack and its visible modifiers without consuming randomness or
 * Command Actions. Resolution is a separate state transition so the shell can
 * present the committed dice procedure before the seeded roll occurs.
 */
export function declareBoardCombat(
  state: BoardGameState,
  attackerPieceId: string,
  defenderPieceId: string
): BoardActionResult {
  const preview = getBoardCombatPreview(state, attackerPieceId, defenderPieceId);
  if (!preview.legal) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: preview.reason
    };
  }

  const combat: BoardCombatState = {
    status: 'declared',
    attackerPieceId,
    defenderPieceId,
    originSpaceId: preview.originSpaceId,
    targetSpaceId: preview.targetSpaceId,
    dieCount: preview.dieCount,
    dieSides: preview.dieSides,
    baseTarget: preview.baseTarget,
    modifiers: { ...preview.modifiers },
    roll: null,
    log: [
      `${attackerPieceId} declared an attack on ${defenderPieceId} from ${preview.originSpaceId} into ${preview.targetSpaceId}.`,
      `Roll 1D20 ${preview.attackModifier >= 0 ? '+' : ''}${preview.attackModifier} against target ${preview.target}.`
    ]
  };

  return {
    state: {
      ...state,
      combat
    },
    accepted: true,
    commandActionsSpent: 0,
    reason: `${attackerPieceId} declared combat against ${defenderPieceId}.`
  };
}

function getResolutionRejectionReason(state: BoardGameState): string | null {
  const combat = state.combat;
  if (!combat || combat.status !== 'declared') {
    return 'No declared combat is awaiting resolution.';
  }

  const legalityReason = getCombatLegalityReason(
    state,
    combat.attackerPieceId,
    combat.defenderPieceId,
    true
  );
  if (legalityReason) return legalityReason;

  const attacker = state.pieces[combat.attackerPieceId];
  const defender = state.pieces[combat.defenderPieceId];
  if (attacker.spaceId !== combat.originSpaceId || defender.spaceId !== combat.targetSpaceId) {
    return 'The declared combat position changed before resolution.';
  }

  return null;
}

/**
 * Resolves the committed D20 roll from authoritative RNG state. This BG5A
 * foundation records hit/miss only; casualty, retreat and control effects are
 * intentionally left to the next combat-resolution slice rather than guessed.
 */
export function resolveBoardCombat(state: BoardGameState): BoardActionResult {
  const rejectionReason = getResolutionRejectionReason(state);
  if (rejectionReason) {
    return {
      state,
      accepted: false,
      commandActionsSpent: 0,
      reason: rejectionReason
    };
  }

  const combat = state.combat as BoardCombatState;
  const random = nextBoardRandom(state.rng);
  const die = Math.floor(random.value * BOARD_COMBAT_DIE_SIDES) + 1;
  const attackModifier = combat.modifiers.supply;
  const target = combat.baseTarget + combat.modifiers.terrain + combat.modifiers.fortification;
  const attackTotal = die + attackModifier;
  const outcome = attackTotal >= target ? 'hit' : 'miss';
  const activeSeatId = state.activeSeat;
  const seats = {
    ...state.seats,
    [activeSeatId]: {
      ...state.seats[activeSeatId],
      commandActionsRemaining: state.seats[activeSeatId].commandActionsRemaining - 1
    }
  };
  const resolvedCombat: BoardCombatState = {
    ...combat,
    status: 'resolved',
    roll: {
      die,
      attackTotal,
      target,
      outcome
    },
    log: [
      ...combat.log,
      `D20 ${die} ${attackModifier >= 0 ? '+' : ''}${attackModifier} = ${attackTotal} vs ${target}: ${outcome.toUpperCase()}.`
    ]
  };
  const paidState: BoardGameState = {
    ...state,
    seats,
    rng: random.rng,
    combat: resolvedCombat
  };
  const nextSeat = getNextActivatingSeatId(paidState);
  const nextState: BoardGameState = nextSeat
    ? { ...paidState, activeSeat: nextSeat }
    : paidState;

  return {
    state: nextState,
    accepted: true,
    commandActionsSpent: 1,
    reason: nextSeat
      ? `${combat.attackerPieceId} rolled ${die}: ${outcome}; activation progressed to ${nextSeat}.`
      : `${combat.attackerPieceId} rolled ${die}: ${outcome}; all participating seats are exhausted.`
  };
}