import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react';
import {
  BOARD_ACTION_HAND_LIMIT,
  getBoardActionCard,
  type BoardActionCardDefinition,
  type BoardActionCardEffect,
  type BoardActionCardFamily
} from '../game/board-action-cards';
import { applyBoardAction as previewBoardAction } from '../game/board-action-dispatcher';
import { getBoardMoveDestinations } from '../game/board-state';
import { TERRITORIES } from '../game/data';
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

const CARD_EFFECT_ICONS: Record<BoardActionCardEffect, string> = {
  'move-piece': '↠',
  'recover-piece': '+',
  'engineer-position': '⌁',
  'logistics-piece': '⇄'
};

const TERRAIN_CLICK_LAYER_ID = 'campaign-territories-fill';
const MAP_PIECE_SELECTOR = '.r3-terrain-task-group-marker[data-group-id], .task-group-marker';

type TerrainMapClickEvent = {
  features?: Array<{
    properties?: Record<string, unknown>;
  }>;
};

type TerrainMapHandle = {
  getLayer: (id: string) => unknown;
  isStyleLoaded: () => boolean;
  on: (type: string, layerId: string, listener: (event: TerrainMapClickEvent) => void) => void;
  off: (type: string, layerId: string, listener: (event: TerrainMapClickEvent) => void) => void;
};

type CardFanStyle = CSSProperties & {
  '--fan-rotate': string;
  '--fan-drop': string;
  '--fan-z': number;
};

function territoryLabel(spaceId: string | null | undefined): string {
  if (!spaceId) return 'Off board';
  const territory = TERRITORIES[spaceId];
  if (!territory) return spaceId;
  return `${territory.centre} · ${territory.name}`;
}

function spaceIdForTerritoryLabel(label: string | null | undefined): string | null {
  const normalised = label?.trim().toLocaleLowerCase();
  if (!normalised) return null;

  const match = Object.values(TERRITORIES).find(territory =>
    territory.id.toLocaleLowerCase() === normalised
    || territory.name.toLocaleLowerCase() === normalised
    || territory.centre.toLocaleLowerCase() === normalised
  );
  return match?.id ?? null;
}

function readMapPieceId(target: Element): string | null {
  const terrainMarker = target.closest('.r3-terrain-task-group-marker[data-group-id]') as HTMLElement | null;
  const terrainGroupId = terrainMarker?.dataset.groupId;
  if (terrainGroupId) return terrainGroupId;

  const svgMarker = target.closest('.task-group-marker');
  const markerText = svgMarker?.querySelector('.marker-id')?.textContent ?? '';
  const match = markerText.match(/TG\s*(\d+)/i);
  return match ? `TG-${match[1]}` : null;
}

function buildCardAction(
  card: BoardActionCardDefinition,
  pieceId: string,
  destinationSpaceId = ''
): BoardAction {
  const action: BoardAction = {
    type: 'play-action-card',
    cardId: card.id,
    pieceId
  };
  if (card.effect === 'move-piece') action.destinationSpaceId = destinationSpaceId;
  return action;
}

function CardBack({ label, count }: { label: string; count: number }) {
  return <div className="tabletop-card-stack" role="img" aria-label={`${label}: ${count} cards`}>
    <span className="tabletop-card-stack-shadow" aria-hidden="true" />
    <span className="tabletop-card-back" aria-hidden="true">
      <i>FC</i>
      <b>FUTURE<br />CONQUEST</b>
      <small>Central Front</small>
    </span>
    <strong>{count}</strong>
    <small>{label}</small>
  </div>;
}

function DiscardStack({ card, count }: { card: BoardActionCardDefinition | null; count: number }) {
  if (!card) return <CardBack label="Discard" count={0} />;
  const family = CARD_FAMILY_PRESENTATION[card.family];
  return <div className="tabletop-card-stack discard" role="img" aria-label={`Discard: ${count} cards, ${card.title} on top`}>
    <span className="tabletop-card-stack-shadow" aria-hidden="true" />
    <span className="tabletop-card-discard-face" data-card-family={card.family} aria-hidden="true">
      <small>{family.code}</small>
      <b>{card.title}</b>
    </span>
    <strong>{count}</strong>
    <small>Discard</small>
  </div>;
}

export function TabletopCardHandPanel() {
  const state = useBoardGameState();
  const dispatch = useBoardGameDispatch();
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedPieceId, setSelectedPieceId] = useState('');
  const [destinationSpaceId, setDestinationSpaceId] = useState('');
  const [feedback, setFeedback] = useState('Choose a card, then select one of your formations directly on the board.');
  const [newlyDrawnCardId, setNewlyDrawnCardId] = useState('');
  const [playedCard, setPlayedCard] = useState<BoardActionCardDefinition | null>(null);
  const previousHandRef = useRef<string[]>([]);
  const destinationIntentRef = useRef<(spaceId: string) => void>(() => undefined);
  const playedCardTimerRef = useRef<number | null>(null);
  const activeSeat = state.seats[state.activeSeat];
  const hand = state.decks.action.handBySeat[state.activeSeat];
  const humanActivation = state.phase === 'activation' && activeSeat.controller === 'human';

  useEffect(() => {
    const previous = previousHandRef.current;
    const drawnCardId = hand.find(cardId => !previous.includes(cardId));
    previousHandRef.current = [...hand];
    if (!drawnCardId || previous.length === 0) return;

    setNewlyDrawnCardId(drawnCardId);
    const timer = window.setTimeout(() => setNewlyDrawnCardId(''), 720);
    return () => window.clearTimeout(timer);
  }, [hand]);

  useEffect(() => () => {
    if (playedCardTimerRef.current !== null) {
      window.clearTimeout(playedCardTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (hand.includes(selectedCardId)) return;
    setSelectedCardId(hand[0] ?? '');
    setSelectedPieceId('');
    setDestinationSpaceId('');
  }, [hand, selectedCardId]);

  const selectedCard = selectedCardId ? getBoardActionCard(selectedCardId) : null;
  const selectedFamily = selectedCard ? CARD_FAMILY_PRESENTATION[selectedCard.family] : null;
  const selectedEffect = selectedCard ? CARD_EFFECT_LABELS[selectedCard.effect] : null;
  const availablePieces = useMemo(() => Object.values(state.pieces)
    .filter(piece => piece.seatId === state.activeSeat && piece.spaceId)
    .sort((left, right) => left.id.localeCompare(right.id)), [state.activeSeat, state.pieces]);

  useEffect(() => {
    if (!selectedPieceId) return;
    if (availablePieces.some(piece => piece.id === selectedPieceId)) return;
    setSelectedPieceId('');
    setDestinationSpaceId('');
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
    if (!destinationSpaceId) return;
    if (moveDestinations.some(destination => destination.spaceId === destinationSpaceId)) return;
    setDestinationSpaceId('');
  }, [destinationSpaceId, moveDestinations, selectedCard?.effect]);

  const playableCardIds = useMemo(() => {
    const playable = new Set<string>();
    if (!humanActivation) return playable;

    for (const cardId of hand) {
      const card = getBoardActionCard(cardId);
      let accepted = false;
      for (const piece of availablePieces) {
        if (card.effect === 'move-piece') {
          const destinations = getBoardMoveDestinations(state, piece.id).filter(destination => destination.legal);
          accepted = destinations.some(destination => previewBoardAction(
            state,
            buildCardAction(card, piece.id, destination.spaceId)
          ).accepted);
        } else {
          accepted = previewBoardAction(state, buildCardAction(card, piece.id)).accepted;
        }
        if (accepted) break;
      }
      if (accepted) playable.add(card.id);
    }
    return playable;
  }, [availablePieces, hand, humanActivation, state]);

  const playAction = useMemo<BoardAction | null>(() => {
    if (!selectedCard || !selectedPieceId) return null;
    if (selectedCard.effect === 'move-piece' && !destinationSpaceId) return null;
    return buildCardAction(selectedCard, selectedPieceId, destinationSpaceId);
  }, [destinationSpaceId, selectedCard, selectedPieceId]);

  const preview = useMemo(
    () => playAction ? previewBoardAction(state, playAction) : null,
    [playAction, state]
  );

  const selectPieceForCard = useCallback((pieceId: string) => {
    if (!selectedCard) {
      setFeedback('Choose a card before selecting a formation.');
      return;
    }
    if (!humanActivation) {
      setFeedback('Cards can only be targeted during your activation.');
      return;
    }

    const piece = state.pieces[pieceId];
    if (!piece || piece.seatId !== state.activeSeat || !piece.spaceId) {
      setFeedback(`${pieceId} is not an available formation for the active player.`);
      return;
    }

    setSelectedPieceId(pieceId);
    setDestinationSpaceId('');
    if (selectedCard.effect === 'move-piece') {
      const legal = getBoardMoveDestinations(state, pieceId).filter(destination => destination.legal);
      setFeedback(legal.length > 0
        ? `${pieceId} selected. Choose one of ${legal.length} legal destinations directly on the map.`
        : `${pieceId} selected, but ${selectedCard.title} has no legal Move destination from here.`);
    } else {
      const candidate = buildCardAction(selectedCard, pieceId);
      const result = previewBoardAction(state, candidate);
      setFeedback(result.accepted
        ? `${pieceId} selected. ${selectedCard.title} is ready to play.`
        : result.reason);
    }
  }, [humanActivation, selectedCard, state]);

  const selectDestinationForCard = useCallback((spaceId: string) => {
    if (selectedCard?.effect !== 'move-piece' || !selectedPieceId) return;
    const destination = moveDestinations.find(candidate => candidate.spaceId === spaceId);
    if (!destination) {
      setFeedback(`${territoryLabel(spaceId)} is not a legal destination for ${selectedCard.title}.`);
      return;
    }
    setDestinationSpaceId(spaceId);
    setFeedback(`${territoryLabel(spaceId)} selected. ${selectedCard.title} is ready to play.`);
  }, [moveDestinations, selectedCard, selectedPieceId]);
  destinationIntentRef.current = selectDestinationForCard;

  useEffect(() => {
    const onBoardClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !selectedCard) return;

      const pieceId = readMapPieceId(target);
      if (pieceId) {
        selectPieceForCard(pieceId);
        return;
      }

      if (selectedCard.effect !== 'move-piece' || !selectedPieceId || !target.closest('.territory, .territory-hit-target')) return;
      window.requestAnimationFrame(() => {
        const heading = document.querySelector<HTMLElement>('.map-context-panel .territory-card h3')?.textContent;
        const spaceId = spaceIdForTerritoryLabel(heading);
        if (spaceId) destinationIntentRef.current(spaceId);
      });
    };

    document.addEventListener('click', onBoardClick, true);
    return () => document.removeEventListener('click', onBoardClick, true);
  }, [selectPieceForCard, selectedCard, selectedPieceId]);

  useEffect(() => {
    let retryTimer: number | null = null;
    let attachedMap: TerrainMapHandle | null = null;
    const onTerrainClick = (event: TerrainMapClickEvent) => {
      const territoryId = event.features?.[0]?.properties?.territory_id;
      if (typeof territoryId === 'string') destinationIntentRef.current(territoryId);
    };

    const attach = () => {
      const map = (window as unknown as { __r3TerrainMap?: TerrainMapHandle }).__r3TerrainMap;
      if (!map || !map.isStyleLoaded() || !map.getLayer(TERRAIN_CLICK_LAYER_ID)) {
        retryTimer = window.setTimeout(attach, 160);
        return;
      }
      attachedMap = map;
      map.on('click', TERRAIN_CLICK_LAYER_ID, onTerrainClick);
    };

    retryTimer = window.setTimeout(attach, 0);
    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (!attachedMap) return;
      try {
        attachedMap.off('click', TERRAIN_CLICK_LAYER_ID, onTerrainClick);
      } catch {
        // The preserved terrain renderer may already have disposed this map.
      }
    };
  }, []);

  useEffect(() => {
    const legalPieces = new Set(availablePieces.map(piece => piece.id));
    const markers = [...document.querySelectorAll(MAP_PIECE_SELECTOR)];
    for (const marker of markers) {
      const pieceId = readMapPieceId(marker);
      marker.classList.toggle('bg12f-card-targetable', Boolean(selectedCard && pieceId && legalPieces.has(pieceId)));
      marker.classList.toggle('bg12f-card-selected', pieceId === selectedPieceId);
    }

    const legalDestinations = new Set(moveDestinations.map(destination => destination.spaceId));
    const labels = [...document.querySelectorAll<SVGGElement>('.map-label')];
    for (const label of labels) {
      const centre = label.querySelector('.territory-centre-label')?.textContent;
      const spaceId = spaceIdForTerritoryLabel(centre);
      label.classList.toggle('bg12f-card-destination', Boolean(spaceId && legalDestinations.has(spaceId)));
      label.classList.toggle('bg12f-card-destination-selected', Boolean(spaceId && spaceId === destinationSpaceId));
    }

    return () => {
      for (const marker of markers) marker.classList.remove('bg12f-card-targetable', 'bg12f-card-selected');
      for (const label of labels) label.classList.remove('bg12f-card-destination', 'bg12f-card-destination-selected');
    };
  }, [availablePieces, destinationSpaceId, moveDestinations, selectedCard, selectedPieceId]);

  const runCard = () => {
    if (!playAction || !selectedCard) return;
    const card = selectedCard;
    const result = dispatch(playAction);
    setFeedback(result.reason);
    if (!result.accepted) return;

    setPlayedCard(card);
    setSelectedPieceId('');
    setDestinationSpaceId('');
    if (playedCardTimerRef.current !== null) {
      window.clearTimeout(playedCardTimerRef.current);
    }
    playedCardTimerRef.current = window.setTimeout(() => {
      setPlayedCard(null);
      playedCardTimerRef.current = null;
    }, 760);
  };

  const availabilityReason = humanActivation && playAction && preview && !preview.accepted
    ? preview.reason
    : null;
  const statusFeedback = availabilityReason ? `Unavailable: ${availabilityReason}` : feedback;
  const discardTopId = state.decks.action.discard[state.decks.action.discard.length - 1];
  const discardTop = discardTopId ? getBoardActionCard(discardTopId) : null;

  return <section
    id="tabletop-card-hand"
    className="tabletop-card-hand"
    aria-label="Strategic card hand"
    data-bg-package="BG8"
    data-bg-feedback="BG11A"
    data-bg-presentation="BG12F"
    tabIndex={-1}
  >
    <header className="tabletop-card-table-heading">
      <div>
        <span>Strategic hand</span>
        <strong>{humanActivation ? `${state.activeSeat} · ${hand.length}/${BOARD_ACTION_HAND_LIMIT} cards` : 'Waiting for human activation'}</strong>
      </div>
      <span className="tabletop-card-table-rule">One-shot free actions</span>
    </header>

    <div className="tabletop-card-table" aria-label="Action card table">
      <div className="tabletop-card-piles" aria-label="Authoritative action card piles">
        <CardBack label="Draw deck" count={state.decks.action.draw.length} />
        <DiscardStack card={discardTop} count={state.decks.action.discard.length} />
      </div>

      <div className="tabletop-card-list" role="list" aria-label="Cards in hand">
        {hand.length === 0 && <p>No cards in hand.</p>}
        {hand.map((cardId, index) => {
          const card = getBoardActionCard(cardId);
          const family = CARD_FAMILY_PRESENTATION[card.family];
          const effect = CARD_EFFECT_LABELS[card.effect];
          const playable = playableCardIds.has(card.id);
          const fanOffset = index - ((hand.length - 1) / 2);
          const fanStyle: CardFanStyle = {
            '--fan-rotate': `${fanOffset * 5.5}deg`,
            '--fan-drop': `${Math.abs(fanOffset) * 5}px`,
            '--fan-z': index + 1
          };
          return <button
            key={card.id}
            type="button"
            role="listitem"
            className={[
              card.id === selectedCardId ? 'selected' : '',
              card.id === newlyDrawnCardId ? 'drawn' : '',
              playable ? 'playable' : 'unplayable'
            ].filter(Boolean).join(' ')}
            data-card-family={card.family}
            data-card-effect={card.effect}
            data-card-art-key={card.id}
            aria-pressed={card.id === selectedCardId}
            aria-label={`${card.title}. ${family.label}. ${effect}. ${playable ? 'Playable' : 'Unavailable'}.`}
            disabled={!humanActivation}
            onClick={() => {
              setSelectedCardId(card.id);
              setSelectedPieceId('');
              setDestinationSpaceId('');
              setFeedback(`${card.title} selected. Choose a formation directly on the board.`);
            }}
            style={fanStyle}
            title={card.summary}
          >
            <span className="tabletop-card-family-row">
              <span className="tabletop-card-family-code" aria-hidden="true">{family.code}</span>
              <small>{family.label}</small>
              <span className="tabletop-card-free-mark">Free</span>
            </span>
            <span className="tabletop-card-art" aria-hidden="true">
              <i>{CARD_EFFECT_ICONS[card.effect]}</i>
              <small>{effect}</small>
            </span>
            <b className="tabletop-card-title">{card.title}</b>
            <span className="tabletop-card-summary">{card.summary}</span>
            <span className="tabletop-card-state">
              <i aria-hidden="true">{playable ? '✓' : '×'}</i>
              {playable ? 'Playable' : 'Unavailable'}
            </span>
          </button>;
        })}
      </div>
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

      <p className="tabletop-card-target-prompt">
        {!selectedPieceId
          ? 'Select one of your formations directly on the board.'
          : selectedCard.effect === 'move-piece' && !destinationSpaceId
            ? `${selectedPieceId} selected · choose a legal destination on the map.`
            : `${selectedPieceId}${destinationSpaceId ? ` → ${territoryLabel(destinationSpaceId)}` : ''}`}
      </p>

      <button
        type="button"
        className="tabletop-card-play-button"
        disabled={!humanActivation || !preview?.accepted}
        title={preview?.reason ?? 'Select the card target on the board.'}
        onClick={runCard}
      >
        Play {selectedEffect} · free action
      </button>

      <details className="tabletop-card-accessibility">
        <summary>Target controls</summary>
        <p>Fallback controls for keyboard or precise target selection.</p>
        <div className="tabletop-card-targets">
          <select
            aria-label="Card formation"
            value={selectedPieceId}
            disabled={!humanActivation || availablePieces.length === 0}
            onChange={event => selectPieceForCard(event.target.value)}
          >
            <option value="">Choose formation</option>
            {availablePieces.map(piece => <option key={piece.id} value={piece.id}>{piece.id}</option>)}
          </select>

          {selectedCard.effect === 'move-piece' && <select
            aria-label="Card destination"
            value={destinationSpaceId}
            disabled={!humanActivation || !selectedPieceId || moveDestinations.length === 0}
            onChange={event => selectDestinationForCard(event.target.value)}
          >
            <option value="">Choose destination</option>
            {moveDestinations.map(destination => <option key={destination.spaceId} value={destination.spaceId}>
              {territoryLabel(destination.spaceId)}
            </option>)}
          </select>}
        </div>
      </details>
    </div>}

    <p className="tabletop-card-feedback" role="status" title={statusFeedback}>{statusFeedback}</p>

    {playedCard && <div className="tabletop-card-play-ghost" data-card-family={playedCard.family} aria-hidden="true">
      <span>{CARD_FAMILY_PRESENTATION[playedCard.family].code}</span>
      <b>{playedCard.title}</b>
      <small>Played</small>
    </div>}
  </section>;
}