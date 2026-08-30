import { useEffect, useMemo, useState } from 'react';
import { applyBoardAction as previewBoardAction } from '../game/board-action-dispatcher';
import { useBoardGameDispatch, useBoardGameState } from './BoardGameStateProvider';
import './tabletop-support.css';

type SupportActionType = 'recover-piece' | 'engineer-position' | 'logistics-piece';

const ACTIONS: Array<{ type: SupportActionType; label: string }> = [
  { type: 'recover-piece', label: 'Recover' },
  { type: 'engineer-position', label: 'Engineer' },
  { type: 'logistics-piece', label: 'Logistics' }
];

export function TabletopSupportPanel() {
  const state = useBoardGameState();
  const dispatch = useBoardGameDispatch();
  const [selectedPieceId, setSelectedPieceId] = useState('');
  const [feedback, setFeedback] = useState('Support actions cost 1 Command Action.');
  const activeSeat = state.seats[state.activeSeat];

  const availablePieces = useMemo(() => Object.values(state.pieces)
    .filter(piece => piece.seatId === state.activeSeat && piece.spaceId)
    .sort((left, right) => left.id.localeCompare(right.id)), [state.activeSeat, state.pieces]);

  useEffect(() => {
    if (availablePieces.some(piece => piece.id === selectedPieceId)) return;
    setSelectedPieceId(availablePieces[0]?.id ?? '');
  }, [availablePieces, selectedPieceId]);

  const selectedPiece = selectedPieceId ? state.pieces[selectedPieceId] : undefined;
  const selectedSpace = selectedPiece?.spaceId ? state.spaces[selectedPiece.spaceId] : undefined;
  const humanActivation = state.phase === 'activation' && activeSeat.controller === 'human';

  const previews = useMemo(() => Object.fromEntries(ACTIONS.map(action => [
    action.type,
    selectedPieceId
      ? previewBoardAction(state, { type: action.type, pieceId: selectedPieceId })
      : null
  ])) as Record<SupportActionType, ReturnType<typeof previewBoardAction> | null>, [selectedPieceId, state]);

  const runAction = (type: SupportActionType) => {
    if (!selectedPieceId) return;
    const result = dispatch({ type, pieceId: selectedPieceId });
    setFeedback(result.reason);
  };

  return <section className="tabletop-support-panel" aria-label="Support actions" data-bg-package="BG7">
    <div className="tabletop-support-heading">
      <div>
        <span>Support actions</span>
        <strong>{humanActivation ? '1 Command Action each' : 'Waiting for human activation'}</strong>
      </div>
      <select
        aria-label="Support formation"
        value={selectedPieceId}
        disabled={!humanActivation || availablePieces.length === 0}
        onChange={event => setSelectedPieceId(event.target.value)}
      >
        {availablePieces.length === 0 && <option value="">No formation available</option>}
        {availablePieces.map(piece => <option key={piece.id} value={piece.id}>{piece.id}</option>)}
      </select>
    </div>

    {selectedPiece && <div className="tabletop-support-status" aria-label={`${selectedPiece.id} support status`}>
      <span><small>Readiness</small><b>{selectedPiece.readiness}</b></span>
      <span><small>Damage</small><b>{selectedPiece.damage}/3</b></span>
      <span><small>Supply</small><b>{selectedPiece.supply}</b></span>
      <span><small>Fortification</small><b>{Math.max(0, Math.trunc(selectedSpace?.fortification ?? 0))}/3</b></span>
    </div>}

    <div className="tabletop-support-actions">
      {ACTIONS.map(action => {
        const preview = previews[action.type];
        const enabled = humanActivation && Boolean(preview?.accepted);
        return <button
          key={action.type}
          type="button"
          disabled={!enabled}
          title={preview?.reason ?? 'Select a formation.'}
          onClick={() => runAction(action.type)}
        >
          {action.label}
        </button>;
      })}
    </div>

    <p role="status">{feedback}</p>
  </section>;
}
