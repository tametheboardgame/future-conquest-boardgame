import {
  isBoardActionCardsPreparedForRound,
  needsBoardActionCardMigration
} from './board-action-cards';
import { getBoardCombatTargets } from './board-combat';
import { isBoardEscalationResolvedForRound } from './board-escalation';
import { applyBoardAction, isBoardRoundExhausted } from './board-state';
import type { BoardAction, BoardGameState } from './board-state-types';

function chooseComputerCombatAction(state: BoardGameState): BoardAction | null {
  const attackers = Object.values(state.pieces)
    .filter(piece => piece.seatId === state.activeSeat && piece.spaceId)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const attacker of attackers) {
    const target = getBoardCombatTargets(state, attacker.id)[0];
    if (!target) continue;
    return {
      type: 'attack-piece',
      attackerPieceId: attacker.id,
      defenderPieceId: target.defenderPieceId
    };
  }

  return null;
}

/**
 * Chooses at most one automatic board action. The provider executes the
 * returned action through the unified runtime dispatcher, so humans and
 * computers share exactly the same authoritative rules.
 */
export function chooseAutomaticBoardAction(state: BoardGameState): BoardAction | null {
  if (state.phase === 'round-start') {
    if (!isBoardEscalationResolvedForRound(state)) return { type: 'resolve-escalation' };
    if (!isBoardActionCardsPreparedForRound(state)) return { type: 'prepare-action-cards' };
    return { type: 'start-round' };
  }

  // Pre-BG8 v3 saves can legitimately resume in the middle of activation.
  // Migrate the empty reserved action deck before any further automatic turn
  // progression so the current round receives its opening hand immediately.
  if (state.phase === 'activation' && needsBoardActionCardMigration(state)) {
    return { type: 'prepare-action-cards' };
  }

  if (state.phase === 'activation' && isBoardRoundExhausted(state)) {
    return { type: 'end-round' };
  }

  if (state.phase === 'round-end') {
    return state.round < state.roundLimit ? { type: 'advance-round' } : null;
  }

  const activeSeat = state.seats[state.activeSeat];
  if (state.phase !== 'activation' || activeSeat.controller !== 'computer') return null;

  // BG5C gives computer seats the first paid board-game action: attack the
  // first legal adjacent target in stable attacker/defender ID order. There is
  // no AI-side roll or outcome calculation here; the returned action still
  // crosses the same authoritative dispatcher used by human attacks.
  const combat = chooseComputerCombatAction(state);
  if (combat) return combat;

  // If combat is unavailable, retain BG3's safe zero-cost yield while another
  // human can still activate. When no other seat can activate we deliberately
  // return null rather than create an infinite Pass loop. Computer movement is
  // a separate future paid-action policy, not a hidden combat fallback.
  const humanCanActivate = Object.values(state.seats).some(seat =>
    seat.participating && seat.controller === 'human' && seat.commandActionsRemaining > 0
  );
  if (!humanCanActivate) return null;

  const pass = applyBoardAction(state, { type: 'pass-activation' });
  return pass.accepted ? { type: 'pass-activation' } : null;
}
