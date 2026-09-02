import { useEffect, useMemo, useState } from 'react';
import { getBoardActionCard } from '../game/board-action-cards';
import { applyBoardAction as previewBoardAction } from '../game/board-action-dispatcher';
import { getBoardMoveDestinations } from '../game/board-state';
import type { BoardAction } from '../game/board-state-types';
import { useBoardGameDispatch, useBoardGameState } from './BoardGameStateProvider';
import './tabletop-card-hand.css';

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

  return <section
    id="tabletop-card-hand"
    className="tabletop-card-hand"
    aria-label="Strategic card hand"
    data-bg-package="BG8"
    data-bg-feedback="BG11A"
    tabIndex={-1}
  >
    <header>
      <div>
        <span>Strategic cards</span>
        <strong>{humanActivation ? `${state.activeSeat} hand` : 'Waiting for human activation'}</strong>
      </div>
      <div className="tabletop-card-piles" aria-label="Action card piles">
        <span><small>Deck</small><b>{state.decks.action.draw.length}</b></span>
        <span><small>Discard</small><b>{state.decks.action.discard.length}</b></span>
      </div>
    </header>

    <div className="tabletop-card-list" role="list" aria-label="Cards in hand">
      {hand.length === 0 && <p>No cards in hand.</p>}
      {hand.map(cardId => {
        const card = getBoardActionCard(cardId);
        return <button
          key={card.id}
          type="button"
          role="listitem"
          className={card.id === selectedCardId ? 'selected' : ''}
          disabled={!humanActivation}
          onClick={() => setSelectedCardId(card.id)}
          title={card.summary}
        >
          <small>{card.family.replace('-', ' ')}</small>
          <b>{card.title}</b>
        </button>;
      })}
    </div>

    {selectedCard && <div className="tabletop-card-play">
      <p><b>{selectedCard.title}</b> — {selectedCard.summary}</p>
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
        Play card · free action
      </button>

      {availabilityReason && <p className="tabletop-card-availability" role="status">
        Unavailable: {availabilityReason}
      </p>}
    </div>}

    <p className="tabletop-card-feedback" role="status">{feedback}</p>
  </section>;
}
