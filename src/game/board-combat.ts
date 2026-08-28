import { TERRITORIES } from './data';
import {
  getNextActivatingSeatId,
  nextBoardRandom
} from './board-state';
import type {
  BoardActionResult,
  BoardCombatConsequence,
  BoardCombatModifiers,
  BoardCombatState,
  BoardGameState,
  BoardPiece,
  BoardSpace,
  SeatId,
  SupplyState
} from './board-state-types';
import type { Terrain } from './types';

export const BOARD_COMBAT_DIE_COUNT = 1 as const;
export const BOARD_COMBAT_DIE_SIDES = 20 as const;
export const BOARD_COMBAT_BASE_TARGET = 11 as const;
export const BOARD_COMBAT_DAMAGE_PER_HIT = 1 as const;
export const BOARD_COMBAT_CRITICAL_DAMAGE = 2 as const;
export const BOARD_COMBAT_READINESS_LOSS = 25 as const;
export const BOARD_COMBAT_CRITICAL_READINESS_LOSS = 50 as const;
export const BOARD_COMBAT_RETREAT_THRESHOLD = 50 as const;
export const BOARD_COMBAT_ELIMINATION_DAMAGE = 3 as const;

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
      possibleOutcomes: string[];
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
    target: BOARD_COMBAT_BASE_TARGET + defenceModifier,
    possibleOutcomes: [
      'Miss: no loss to the defender.',
      `Hit: +${BOARD_COMBAT_DAMAGE_PER_HIT} damage and -${BOARD_COMBAT_READINESS_LOSS} readiness.`,
      `Natural 20: +${BOARD_COMBAT_CRITICAL_DAMAGE} damage and -${BOARD_COMBAT_CRITICAL_READINESS_LOSS} readiness.`,
      `At ${BOARD_COMBAT_RETREAT_THRESHOLD} readiness or lower the defender must retreat if a legal space exists.`,
      `${BOARD_COMBAT_ELIMINATION_DAMAGE} damage or 0 readiness eliminates the defender.`
    ]
  };
}

/**
 * Returns the exact seeded-dice contract the UI can show before commitment.
 * Presentation consumes this preview rather than recreating combat rules.
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

/** Legal enemy-piece targets for one attacker, in stable piece-id order. */
export function getBoardCombatTargets(
  state: BoardGameState,
  attackerPieceId: string
): Extract<BoardCombatPreview, { legal: true }>[] {
  return Object.values(state.pieces)
    .filter(piece => piece.id !== attackerPieceId)
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap(piece => {
      const preview = getBoardCombatPreview(state, attackerPieceId, piece.id);
      return preview.legal ? [preview] : [];
    });
}

/**
 * Locks a legal attack and its visible modifiers without consuming randomness or
 * Command Actions. Resolution remains separate internally so future dice
 * presentation can animate a committed roll without gaining rules authority.
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

function hasHostileOccupant(state: BoardGameState, spaceId: string, seatId: SeatId): boolean {
  return Object.values(state.pieces).some(piece =>
    piece.spaceId === spaceId && piece.seatId !== seatId
  );
}

function chooseRetreatSpaceId(
  state: BoardGameState,
  defender: BoardPiece,
  originSpaceId: string,
  targetSpaceId: string
): string | null {
  return state.spaces[targetSpaceId].adjacentSpaceIds
    .filter(spaceId => spaceId !== originSpaceId)
    .filter(spaceId => {
      const space = state.spaces[spaceId];
      if (!space) return false;
      if (space.control !== null && space.control !== defender.seatId) return false;
      return !hasHostileOccupant(state, spaceId, defender.seatId);
    })
    .sort((a, b) => {
      const aFriendly = state.spaces[a].control === defender.seatId ? 0 : 1;
      const bFriendly = state.spaces[b].control === defender.seatId ? 0 : 1;
      return aFriendly - bFriendly || a.localeCompare(b);
    })[0] ?? null;
}

function resolveHitConsequences(
  state: BoardGameState,
  combat: BoardCombatState,
  die: number
): {
  pieces: BoardGameState['pieces'];
  spaces: BoardGameState['spaces'];
  consequence: BoardCombatConsequence;
  log: string[];
} {
  const attacker = state.pieces[combat.attackerPieceId];
  const defender = state.pieces[combat.defenderPieceId];
  const critical = die === BOARD_COMBAT_DIE_SIDES;
  let readinessLoss = critical ? BOARD_COMBAT_CRITICAL_READINESS_LOSS : BOARD_COMBAT_READINESS_LOSS;
  let damageInflicted = critical ? BOARD_COMBAT_CRITICAL_DAMAGE : BOARD_COMBAT_DAMAGE_PER_HIT;
  let nextReadiness = Math.max(0, defender.readiness - readinessLoss);
  let nextDamage = defender.damage + damageInflicted;
  let defenderStatus: BoardCombatConsequence['defenderStatus'] = 'held';
  let retreatSpaceId: string | null = null;
  const log: string[] = [
    `${combat.defenderPieceId} takes ${damageInflicted} damage and loses ${readinessLoss} readiness.`
  ];

  if (nextDamage >= BOARD_COMBAT_ELIMINATION_DAMAGE || nextReadiness <= 0) {
    defenderStatus = 'eliminated';
  } else if (critical || nextReadiness <= BOARD_COMBAT_RETREAT_THRESHOLD) {
    retreatSpaceId = chooseRetreatSpaceId(state, defender, combat.originSpaceId, combat.targetSpaceId);
    if (retreatSpaceId) {
      defenderStatus = 'retreated';
    } else {
      damageInflicted += 1;
      readinessLoss += BOARD_COMBAT_READINESS_LOSS;
      nextDamage += 1;
      nextReadiness = Math.max(0, nextReadiness - BOARD_COMBAT_READINESS_LOSS);
      log.push(`${combat.defenderPieceId} has no legal retreat and takes 1 additional damage and ${BOARD_COMBAT_READINESS_LOSS} additional readiness loss.`);
      if (nextDamage >= BOARD_COMBAT_ELIMINATION_DAMAGE || nextReadiness <= 0) {
        defenderStatus = 'eliminated';
      }
    }
  }

  let pieces: BoardGameState['pieces'] = {
    ...state.pieces,
    [defender.id]: {
      ...defender,
      readiness: nextReadiness,
      damage: nextDamage,
      spaceId: defenderStatus === 'eliminated'
        ? null
        : defenderStatus === 'retreated'
          ? retreatSpaceId
          : defender.spaceId
    }
  };

  if (defenderStatus === 'eliminated') {
    log.push(`${combat.defenderPieceId} is eliminated.`);
  } else if (defenderStatus === 'retreated') {
    log.push(`${combat.defenderPieceId} retreats to ${retreatSpaceId}.`);
  } else {
    log.push(`${combat.defenderPieceId} holds ${combat.targetSpaceId} at ${nextReadiness} readiness.`);
  }

  const hostilePiecesRemain = Object.values(pieces).some(piece =>
    piece.spaceId === combat.targetSpaceId && piece.seatId !== attacker.seatId
  );
  const targetCleared = !hostilePiecesRemain && defenderStatus !== 'held';
  let spaces = state.spaces;
  let attackerAdvanced = false;
  let controlChanged = false;

  if (targetCleared) {
    attackerAdvanced = true;
    controlChanged = state.spaces[combat.targetSpaceId].control !== attacker.seatId;
    pieces = {
      ...pieces,
      [attacker.id]: {
        ...attacker,
        spaceId: combat.targetSpaceId
      }
    };
    spaces = {
      ...state.spaces,
      [combat.targetSpaceId]: {
        ...state.spaces[combat.targetSpaceId],
        control: attacker.seatId
      }
    };
    log.push(`${combat.attackerPieceId} advances into ${combat.targetSpaceId}${controlChanged ? ' and takes control' : ''}.`);
  }

  return {
    pieces,
    spaces,
    consequence: {
      critical,
      readinessLoss,
      damageInflicted,
      defenderStatus,
      retreatSpaceId,
      attackerAdvanced,
      controlChanged
    },
    log
  };
}

/**
 * Resolves the committed D20 roll from authoritative RNG state and applies the
 * explicit BG5B damage/readiness/retreat/elimination/control procedure.
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

  const consequenceResult = outcome === 'hit'
    ? resolveHitConsequences(state, combat, die)
    : {
        pieces: state.pieces,
        spaces: state.spaces,
        consequence: {
          critical: false,
          readinessLoss: 0,
          damageInflicted: 0,
          defenderStatus: 'held' as const,
          retreatSpaceId: null,
          attackerAdvanced: false,
          controlChanged: false
        },
        log: [`${combat.defenderPieceId} takes no loss and holds ${combat.targetSpaceId}.`]
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
    consequence: consequenceResult.consequence,
    log: [
      ...combat.log,
      `D20 ${die} ${attackModifier >= 0 ? '+' : ''}${attackModifier} = ${attackTotal} vs ${target}: ${outcome.toUpperCase()}.`,
      ...consequenceResult.log
    ]
  };
  const paidState: BoardGameState = {
    ...state,
    seats,
    pieces: consequenceResult.pieces,
    spaces: consequenceResult.spaces,
    rng: random.rng,
    combat: resolvedCombat
  };
  const nextSeat = getNextActivatingSeatId(paidState);
  const nextState: BoardGameState = nextSeat
    ? { ...paidState, activeSeat: nextSeat }
    : paidState;
  const resultSummary = outcome === 'miss'
    ? 'miss, defender held'
    : `${consequenceResult.consequence.critical ? 'critical ' : ''}hit, defender ${consequenceResult.consequence.defenderStatus}`;

  return {
    state: nextState,
    accepted: true,
    commandActionsSpent: 1,
    reason: nextSeat
      ? `${combat.attackerPieceId} rolled ${die}: ${resultSummary}; activation progressed to ${nextSeat}.`
      : `${combat.attackerPieceId} rolled ${die}: ${resultSummary}; all participating seats are exhausted.`
  };
}

/** Atomic runtime attack used by the shared dispatcher after UI preview. */
export function attackBoardPiece(
  state: BoardGameState,
  attackerPieceId: string,
  defenderPieceId: string
): BoardActionResult {
  const declared = declareBoardCombat(state, attackerPieceId, defenderPieceId);
  if (!declared.accepted) return declared;
  return resolveBoardCombat(declared.state);
}