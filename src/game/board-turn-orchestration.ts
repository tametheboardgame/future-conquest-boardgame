import {
  isBoardActionCardsPreparedForRound,
  needsBoardActionCardMigration
} from './board-action-cards';
import {
  isBoardCampaignResolved,
  isBoardCampaignRoundScored,
  shouldResolveBoardCampaign
} from './board-campaign';
import { chooseComputerBoardAction } from './board-computer-player';
import { isBoardEscalationResolvedForRound } from './board-escalation';
import { isBoardRoundExhausted } from './board-state';
import type { BoardAction, BoardGameState } from './board-state-types';

/**
 * Chooses at most one automatic board action. The provider executes the
 * returned action through the unified runtime dispatcher, so humans and
 * computers share exactly the same authoritative rules.
 */
export function chooseAutomaticBoardAction(state: BoardGameState): BoardAction | null {
  if (isBoardCampaignResolved(state)) return null;

  if (state.phase === 'round-end') {
    if (!isBoardCampaignRoundScored(state)) return { type: 'score-campaign-round' };
    if (shouldResolveBoardCampaign(state)) return { type: 'resolve-campaign' };
    if (state.round < state.roundLimit) return { type: 'advance-round' };
    return { type: 'resolve-campaign' };
  }

  // Sudden BG10 victory/defeat resolves before any further round, card or AI
  // progression. The resolver itself still validates the terminal condition.
  if (shouldResolveBoardCampaign(state)) return { type: 'resolve-campaign' };

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

  const activeSeat = state.seats[state.activeSeat];
  if (state.phase !== 'activation' || activeSeat.controller !== 'computer') return null;

  // BG9 owns computer policy only. The selected action still crosses the same
  // authoritative dispatcher as a human action and is chosen without hidden
  // dice rolls, state mutation or an alternative legality path.
  return chooseComputerBoardAction(state);
}
