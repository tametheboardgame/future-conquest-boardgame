import { useEffect, useMemo, useState } from 'react';
import {
  BOARD_ACTION_HAND_LIMIT,
  getBoardActionCard,
  type BoardActionCardEffect,
  type BoardActionCardFamily
} from '../game/board-action-cards';
import { applyBoardAction as previewBoardAction } from '../game/board-action-dispatcher';
import { getBoardMoveDestinations } from '../game/board-state';
import type { BoardAction } from '../game/board-state-types';
import { useBoardGameDispatch, useBoardGameState } from './BoardGameStateProvider';
import './tabletop-card-hand.css';

const CARD_FAMILY_PRESENTATION: Record<BoardActionCardFamily, { code: string; label: string }> = {
  command: { code: 'CMD', label: 'Command' },
  support: { code: 'SPT', label: 'Support' },
  event: { code: 'EVT', label: 'Event' },
  escalation: { code: 'ESC', label: 'Escalation' },
  'national-response': { code: 'NAT', label: 'National response' },
  scenario: { code: 'SCN', label: 'Scenario' }
};

const CARD_EFFECT_LABELS: Record<BoardActionCardEffect, string> = {
  'move-piece': 'Move',
  'recover-piece': 'Recover',
  'engineer-position': 'Engineer',
  'logistics-piece': 'Logistics'
};

export function TabletopCardHandPanel() {
  const state = useBoardGameState();
  const dispatch = useBoardGameDispatch();
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedPieceId, setSelectedPieceId] = useState('');
  const [destinationSpaceId, setDestinationSpaceId] = useState('');
  const [feedback, setFeedback] = useState('Cards are free one-shot exceptions around normal board actions.');
  const activeSeat = state.seats[state.activeSeat];
  const hand = state.decks.action.handBySeat[state.activeSeat];
  const humanActivation = state.phase === 'activation' && activeSeat.controller === 'human';

  useEffect(() => {
    if (hand.includes(selectedCardId)) return;
    setSelectedCardId(hand[0] ?? '');
  }, [hand, selectedCardId]);

  const selectedCard = selectedCardId ? getBoardActionCard(selectedCardId) : null;
  const selectedFamily = selectedCard ? CARD_FAMILY_PRESENTATION[selectedCard.family] : null;
  const selectedEffect = selectedCard ? CARD_EFFECT_LABELS[selectedCard.effect] : null;
  const availablePieces = useMemo(() => Object.values(state.pieces)
    .filter(piece => piece.seatId === state.activeSeat && piece.spaceId)
    .sort((left, right) => left.id.localeCompare(right.id)), [state.activeSeat, state.pieces]);

  useEffect(() => {
    if (availablePieces.some(piece => piece.id === selectedPieceId)) return;
    setSelectedPieceId(availablePieces[0]?.id ?? '');
  }, [availablePieces, selectedPieceId]);

  const moveDestinations = useMemo(() => {
    if (!selectedPieceId || selectedCard?.effect !== 'move-piece') return [];
    return getBoardMoveDestinations(state, selectedPieceId).filter(destination => destination.legal);
  }, [selectedCard?.effect, selectedPieceId, state]);

  useEffect(() => {
    if (selectedCard?.effect !== 'move-piece') {
      setDestinationSpaceId('');
      return;
    }
    if (moveDestinations.some(destination => destination.spaceId === destinationSpaceId)) return;
    setDestinationSpaceId(moveDestinations[0]?.spaceId ?? '');
  }, [destinationSpaceId, moveDestinations, selectedCard?.effect]);

  const playAction = useMemo<BoardAction | null>(() => {
    if (!selectedCard || !selectedPieceId) return null;
    const action: BoardAction = {
      type: 'play-action-card',
      cardId: selectedCard.id,
      pieceId: selectedPieceId
    };
    if (selectedCard.effect === 'move-piece') action.destinationSpaceId = destinationSpaceId;
    return action;
  }, [destinationSpaceId, selectedCard, selectedPieceId]);

  const preview = useMemo(
    () => playAction ? previewBoardAction(state, playAction) : null,
    [playAction, state]
  );

  const runCard = () => {
    if (!playAction) return;
    const result = dispatch(playAction);
    setFeedback(result.reason);
  };

  const availabilityReason = humanActivation && playAction && preview && !preview.accepted
    ? preview.reason
    : null;
  const statusFeedback = availabilityReason ? `Unavailable: ${availabilityReason}` : feedback;

  return <section
    id="tabletop-card-hand"
    className="tabletop-card-hand"
    aria-label="Strategic card hand"
    data-bg-package="BG8"
    data-bg-feedback="BG11A"
    data-bg-presentation="BG11D"
    tabIndex={-1}
  >
    <header>
      <div>
        <span>Strategic cards</span>
        <strong>{humanActivation ? `${state.activeSeat} hand` : 'Waiting for human activation'}</strong>
      </div>
      <div className="tabletop-card-piles" aria-label="Action card piles">
        <span><small>Hand</small><b>{hand.length}/{BOARD_ACTION_HAND_LIMIT}</b></span>
        <span><small>Deck</small><b>{state.decks.action.draw.length}</b></span>
        <span><small>Discard</small><b>{state.decks.action.discard.length}</b></span>
      </div>
    </header>

    <div className="tabletop-card-list" role="list" aria-label="Cards in hand">
      {hand.length === 0 && <p>No cards in hand.</p>}
      {hand.map(cardId => {
        const card = getBoardActionCard(cardId);
        const family = CARD_FAMILY_PRESENTATION[card.family];
        const effect = CARD_EFFECT_LABELS[card.effect];
        return <button
          key={card.id}
          type="button"
          role="listitem"
          className={card.id === selectedCardId ? 'selected' : ''}
          data-card-family={card.family}
          data-card-effect={card.effect}
          aria-pressed={card.id === selectedCardId}
          disabled={!humanActivation}
          onClick={() => setSelectedCardId(card.id)}
          title={card.summary}
        >
          <span className="tabletop-card-family-row">
            <span className="tabletop-card-family-code" aria-hidden="true">{family.code}</span>
            <small>{family.label}</small>
            <span className="tabletop-card-free-mark">Free</span>
          </span>
          <b>{card.title}</b>
          <span className="tabletop-card-effect">{effect}</span>
        </button>;
      })}
    </div>

    {selectedCard && selectedFamily && selectedEffect && <div
      className="tabletop-card-play"
      data-card-family={selectedCard.family}
      data-card-effect={selectedCard.effect}
    >
      <div className="tabletop-card-selected-heading">
        <span className="tabletop-card-family-code" aria-hidden="true">{selectedFamily.code}</span>
        <div>
          <small>{selectedFamily.label} · free action</small>
          <b>{selectedCard.title}</b>
        </div>
        <span className="tabletop-card-effect">{selectedEffect}</span>
      </div>
      <p>{selectedCard.summary}</p>
      <p className="tabletop-card-rule-note">
        Uses ordinary {selectedEffect} legality · Command Action refunded after a successful play.
      </p>
      <div className="tabletop-card-targets">
        <select
          aria-label="Card formation"
          value={selectedPieceId}
          disabled={!humanActivation || availablePieces.length === 0}
          onChange={event => setSelectedPieceId(event.target.value)}
        >
          {availablePieces.length === 0 && <option value="">No formation available</option>}
          {availablePieces.map(piece => <option key={piece.id} value={piece.id}>{piece.id}</option>)}
        </select>

        {selectedCard.effect === 'move-piece' && <select
          aria-label="Card destination"
          value={destinationSpaceId}
          disabled={!humanActivation || moveDestinations.length === 0}
          onChange={event => setDestinationSpaceId(event.target.value)}
        >
          {moveDestinations.length === 0 && <option value="">No legal destination</option>}
          {moveDestinations.map(destination => <option key={destination.spaceId} value={destination.spaceId}>
            {destination.spaceId}
          </option>)}
        </select>}
      </div>

      <button
        type="button"
        className="tabletop-card-play-button"
        disabled={!humanActivation || !preview?.accepted}
        title={preview?.reason ?? 'Select a card and formation.'}
        onClick={runCard}
      >
        Play {selectedEffect} · free action
      </button>
    </div>}

    <p className="tabletop-card-feedback" role="status" title={statusFeedback}>{statusFeedback}</p>
  </section>;
}
