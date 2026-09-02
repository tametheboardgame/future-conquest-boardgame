import { useMemo } from 'react';
import { getBoardCombatTargets } from '../game/board-combat';
import { projectBoardCampaignStatus } from '../game/board-campaign';
import { applyBoardAction as previewBoardAction } from '../game/board-action-dispatcher';
import { getBoardMoveDestinations } from '../game/board-state';
import type { BoardAction } from '../game/board-state-types';
import { useBoardGameState } from './BoardGameStateProvider';
import './tabletop-rules-reference.css';

const SUPPORT_ACTION_TYPES = ['recover-piece', 'engineer-position', 'logistics-piece'] as const;
type SupportActionType = typeof SUPPORT_ACTION_TYPES[number];

function supportPreviewAction(type: SupportActionType, pieceId: string): BoardAction {
  return { type, pieceId } as BoardAction;
}

export function TabletopContextHint() {
  const state = useBoardGameState();
  const campaign = projectBoardCampaignStatus(state);
  const activeSeat = state.seats[state.activeSeat];

  const preview = useMemo(() => {
    const activePieces = Object.values(state.pieces)
      .filter(piece => piece.seatId === state.activeSeat && piece.spaceId);
    const movable = activePieces.filter(piece =>
      getBoardMoveDestinations(state, piece.id).some(destination => destination.legal)
    ).length;
    const attackers = activePieces.filter(piece => getBoardCombatTargets(state, piece.id).length > 0).length;
    const supportTypes = SUPPORT_ACTION_TYPES.filter(type =>
      activePieces.some(piece => previewBoardAction(state, supportPreviewAction(type, piece.id)).accepted)
    ).length;
    const cards = state.decks.action.handBySeat[state.activeSeat]?.length ?? 0;
    const pass = previewBoardAction(state, { type: 'pass-activation' });

    return { activePieces: activePieces.length, movable, attackers, supportTypes, cards, canPass: pass.accepted };
  }, [state]);

  let guidance: string;
  if (campaign.outcome !== 'in-progress') {
    guidance = campaign.reason ?? 'The campaign is complete. Review the result and start a new campaign when ready.';
  } else if (state.phase === 'round-start') {
    guidance = 'Round start resolves escalation and reinforcements before alternating activations begin.';
  } else if (state.phase === 'round-end') {
    guidance = 'Round end scores strategic objectives and checks campaign victory before the next round.';
  } else if (activeSeat.controller === 'computer') {
    guidance = 'Computer activation in progress. It uses the same legal board actions and rules as a human player.';
  } else if (activeSeat.commandActionsRemaining <= 0) {
    guidance = preview.canPass
      ? 'No Command Actions remain for this seat. Pass Activation to continue the round.'
      : 'No Command Actions remain. The turn sequence will advance when the current activation resolves.';
  } else if (preview.attackers > 0) {
    guidance = `${preview.attackers} formation${preview.attackers === 1 ? '' : 's'} can attack now. Select a formation to compare its D20 preview before committing.`;
  } else if (preview.movable > 0) {
    guidance = `${preview.movable} formation${preview.movable === 1 ? '' : 's'} can move now. Select a formation on the board to reveal legal adjacent destinations.`;
  } else if (preview.supportTypes > 0) {
    guidance = 'No immediate move or attack is available, but at least one Recover, Engineer or Logistics action is legal.';
  } else {
    guidance = 'No paid formation action is currently legal. Strategic cards or Pass Activation may still be available.';
  }

  return <aside className="tabletop-context-hint" aria-label="Contextual action guidance" data-bg-feedback="BG11B">
    <span>Next useful action</span>
    <p>{guidance}</p>
    {state.phase === 'activation' && activeSeat.controller === 'human' && <div className="tabletop-action-preview-counts" aria-label="Current legal action preview">
      <b title="Formations with at least one legal Move">Move {preview.movable}</b>
      <b title="Formations with at least one legal Attack">Attack {preview.attackers}</b>
      <b title="Distinct support action types currently legal">Support {preview.supportTypes}</b>
      <b title="Strategic cards in the active seat hand">Cards {preview.cards}</b>
      <b title="Whether Pass Activation is currently legal">Pass {preview.canPass ? 'ready' : 'blocked'}</b>
    </div>}
  </aside>;
}
