import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBoardCombatTargets } from '../game/board-combat';
import { applyBoardAction as previewBoardAction } from '../game/board-action-dispatcher';
import { getBoardMoveDestinations } from '../game/board-state';
import { TERRITORIES } from '../game/data';
import { useBoardGameDispatch, useBoardGameState } from './BoardGameStateProvider';
import { TabletopCombatPanel } from './TabletopCombatPanel';
import './tabletop-formation-interaction.css';

type FormationMode = 'move' | 'attack' | 'support' | 'pass';
type SupportActionType = 'recover-piece' | 'engineer-position' | 'logistics-piece';

type TerrainMapClickEvent = {
  features?: Array<{
    id?: string | number;
    properties?: Record<string, unknown>;
  }>;
};

type TerrainMapHandle = {
  getSource: (id: string) => unknown;
  getLayer: (id: string) => unknown;
  addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
  removeLayer: (id: string) => void;
  isStyleLoaded: () => boolean;
  setFeatureState: (
    target: { source: string; id: string | number },
    state: Record<string, unknown>
  ) => void;
  on: (type: string, layerId: string, listener: (event: TerrainMapClickEvent) => void) => void;
  off: (type: string, layerId: string, listener: (event: TerrainMapClickEvent) => void) => void;
};

type MoveVisualState = {
  boardSpaceIds: string[];
  legalSpaceIds: string[];
  blockedSpaceIds: string[];
  previewSpaceId: string | null;
};

const SUPPORT_ACTIONS: Array<{ type: SupportActionType; label: string }> = [
  { type: 'recover-piece', label: 'Recover' },
  { type: 'engineer-position', label: 'Engineer' },
  { type: 'logistics-piece', label: 'Logistics' }
];

const TERRAIN_SOURCE_ID = 'campaign-territories';
const TERRAIN_CLICK_LAYER_ID = 'campaign-territories-fill';
const TERRAIN_STATE_OUTLINE_LAYER_ID = 'campaign-state-outline';
const BG12H_MOVE_FILL_LAYER_ID = 'bg12h-move-destinations-fill';
const BG12H_MOVE_OUTLINE_LAYER_ID = 'bg12h-move-destinations-outline';
const MAP_PIECE_SELECTOR = '.r3-terrain-task-group-marker[data-group-id], .task-group-marker';

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

function ensureTerrainMoveLayers(map: TerrainMapHandle) {
  if (!map.getLayer(BG12H_MOVE_FILL_LAYER_ID)) {
    map.addLayer({
      id: BG12H_MOVE_FILL_LAYER_ID,
      type: 'fill',
      source: TERRAIN_SOURCE_ID,
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'bg12hPreview'], false], '#f2cf72',
          ['boolean', ['feature-state', 'bg12hLegal'], false], '#65d8b2',
          ['boolean', ['feature-state', 'bg12hBlocked'], false], '#d46d68',
          '#000000'
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'bg12hPreview'], false], 0.34,
          ['boolean', ['feature-state', 'bg12hLegal'], false], 0.2,
          ['boolean', ['feature-state', 'bg12hBlocked'], false], 0.11,
          0
        ]
      }
    }, TERRAIN_STATE_OUTLINE_LAYER_ID);
  }

  if (!map.getLayer(BG12H_MOVE_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: BG12H_MOVE_OUTLINE_LAYER_ID,
      type: 'line',
      source: TERRAIN_SOURCE_ID,
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'bg12hPreview'], false], '#ffe39a',
          ['boolean', ['feature-state', 'bg12hLegal'], false], '#8ffff1',
          ['boolean', ['feature-state', 'bg12hBlocked'], false], '#ec8a82',
          '#000000'
        ],
        'line-opacity': [
          'case',
          ['any',
            ['boolean', ['feature-state', 'bg12hPreview'], false],
            ['boolean', ['feature-state', 'bg12hLegal'], false],
            ['boolean', ['feature-state', 'bg12hBlocked'], false]
          ],
          0.94,
          0
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'bg12hPreview'], false], 3.3,
          ['boolean', ['feature-state', 'bg12hLegal'], false], 2.5,
          ['boolean', ['feature-state', 'bg12hBlocked'], false], 1.8,
          0
        ]
      }
    }, TERRAIN_STATE_OUTLINE_LAYER_ID);
  }
}

function applyTerrainMoveHighlights(map: TerrainMapHandle, visual: MoveVisualState) {
  const legal = new Set(visual.legalSpaceIds);
  const blocked = new Set(visual.blockedSpaceIds);

  for (const spaceId of visual.boardSpaceIds) {
    map.setFeatureState({ source: TERRAIN_SOURCE_ID, id: spaceId }, {
      bg12hLegal: legal.has(spaceId),
      bg12hBlocked: blocked.has(spaceId),
      bg12hPreview: visual.previewSpaceId === spaceId
    });
  }
}

function clearTerrainMoveHighlights(map: TerrainMapHandle, spaceIds: string[]) {
  for (const spaceId of spaceIds) {
    map.setFeatureState({ source: TERRAIN_SOURCE_ID, id: spaceId }, {
      bg12hLegal: false,
      bg12hBlocked: false,
      bg12hPreview: false
    });
  }
}

/**
 * BG12H owns the normal formation-centred interaction surface. It composes
 * existing authoritative move/combat/support/pass APIs and keeps the map as the
 * primary target-selection surface. It does not own rules or RNG.
 */
export function TabletopFormationInteraction() {
  const boardState = useBoardGameState();
  const dispatchBoardAction = useBoardGameDispatch();
  const activeSeat = boardState.seats[boardState.activeSeat];
  const humanActivation = boardState.phase === 'activation' && activeSeat.controller === 'human';

  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [mode, setMode] = useState<FormationMode | null>(null);
  const [pendingDestinationSpaceId, setPendingDestinationSpaceId] = useState<string | null>(null);
  const [pendingSupportAction, setPendingSupportAction] = useState<SupportActionType | null>(null);
  const [combatRolling, setCombatRolling] = useState(false);
  const [feedback, setFeedback] = useState('Select one of your formations on the board.');

  const terrainMapRef = useRef<TerrainMapHandle | null>(null);
  const moveVisualRef = useRef<MoveVisualState>({
    boardSpaceIds: [],
    legalSpaceIds: [],
    blockedSpaceIds: [],
    previewSpaceId: null
  });
  const modeRef = useRef<FormationMode | null>(mode);
  const selectedPieceIdRef = useRef<string | null>(selectedPieceId);
  const completionTimerRef = useRef<number | null>(null);
  modeRef.current = mode;
  selectedPieceIdRef.current = selectedPieceId;

  const selectedPiece = selectedPieceId ? boardState.pieces[selectedPieceId] : undefined;
  const selectedOrigin = selectedPiece?.spaceId ? boardState.spaces[selectedPiece.spaceId] : undefined;

  const moveDestinations = useMemo(
    () => selectedPieceId ? getBoardMoveDestinations(boardState, selectedPieceId) : [],
    [boardState, selectedPieceId]
  );
  const adjacentMoveDestinations = useMemo(
    () => moveDestinations.filter(destination => selectedOrigin?.adjacentSpaceIds.includes(destination.spaceId)),
    [moveDestinations, selectedOrigin]
  );
  const legalMoveDestinations = useMemo(
    () => adjacentMoveDestinations.filter(destination => destination.legal),
    [adjacentMoveDestinations]
  );
  const blockedMoveDestinations = useMemo(
    () => adjacentMoveDestinations.filter(destination => !destination.legal),
    [adjacentMoveDestinations]
  );
  const combatTargets = useMemo(
    () => selectedPieceId ? getBoardCombatTargets(boardState, selectedPieceId) : [],
    [boardState, selectedPieceId]
  );
  const supportPreviews = useMemo(() => SUPPORT_ACTIONS.map(action => ({
    ...action,
    preview: selectedPieceId
      ? previewBoardAction(boardState, { type: action.type, pieceId: selectedPieceId })
      : null
  })), [boardState, selectedPieceId]);
  const supportAvailable = supportPreviews.some(action => action.preview?.accepted);
  const passPreview = useMemo(
    () => previewBoardAction(boardState, { type: 'pass-activation' }),
    [boardState]
  );

  const clearCompletionTimer = useCallback(() => {
    if (completionTimerRef.current === null) return;
    window.clearTimeout(completionTimerRef.current);
    completionTimerRef.current = null;
  }, []);

  const collapseInteraction = useCallback((message: string) => {
    clearCompletionTimer();
    setSelectedPieceId(null);
    setMode(null);
    setPendingDestinationSpaceId(null);
    setPendingSupportAction(null);
    setCombatRolling(false);
    setFeedback(message);
  }, [clearCompletionTimer]);

  const selectFormation = useCallback((pieceId: string) => {
    clearCompletionTimer();
    if (!humanActivation) {
      setFeedback(activeSeat.controller === 'computer'
        ? 'Computer activation in progress.'
        : `Formation actions are unavailable during the ${boardState.phase} phase.`);
      return;
    }

    const piece = boardState.pieces[pieceId];
    if (!piece) {
      setFeedback(`Unknown board piece: ${pieceId}.`);
      return;
    }
    if (piece.seatId !== boardState.activeSeat) {
      setFeedback(`${pieceId} is not controlled by the active seat.`);
      return;
    }

    setSelectedPieceId(pieceId);
    setMode(null);
    setPendingDestinationSpaceId(null);
    setPendingSupportAction(null);
    setCombatRolling(false);
    setFeedback(`${pieceId} selected. Choose Move, Attack, Support or Pass.`);
  }, [activeSeat.controller, boardState, clearCompletionTimer, humanActivation]);

  const handleDestinationIntent = useCallback((spaceId: string) => {
    if (modeRef.current !== 'move' || !selectedPieceIdRef.current) return;
    const evaluation = moveDestinations.find(destination => destination.spaceId === spaceId);
    if (!evaluation) {
      setFeedback(`${territoryLabel(spaceId)} is not an adjacent Move destination.`);
      return;
    }
    if (!evaluation.legal) {
      setPendingDestinationSpaceId(null);
      setFeedback(evaluation.reason ?? `${territoryLabel(spaceId)} is unavailable.`);
      return;
    }

    setPendingDestinationSpaceId(spaceId);
    setFeedback(`Move ${selectedPieceIdRef.current} to ${territoryLabel(spaceId)}? Confirm to spend 1 Command Action.`);
  }, [moveDestinations]);

  const destinationIntentRef = useRef(handleDestinationIntent);
  destinationIntentRef.current = handleDestinationIntent;

  const movementVisual = useMemo<MoveVisualState>(() => ({
    boardSpaceIds: Object.keys(boardState.spaces),
    legalSpaceIds: mode === 'move' ? legalMoveDestinations.map(destination => destination.spaceId) : [],
    blockedSpaceIds: mode === 'move' ? blockedMoveDestinations.map(destination => destination.spaceId) : [],
    previewSpaceId: mode === 'move' ? pendingDestinationSpaceId : null
  }), [boardState.spaces, blockedMoveDestinations, legalMoveDestinations, mode, pendingDestinationSpaceId]);
  moveVisualRef.current = movementVisual;

  useEffect(() => {
    return () => clearCompletionTimer();
  }, [clearCompletionTimer]);

  useEffect(() => {
    if (!selectedPieceId) return;
    if (mode === 'attack' && (combatRolling || completionTimerRef.current !== null)) return;
    const piece = boardState.pieces[selectedPieceId];
    if (humanActivation && piece?.seatId === boardState.activeSeat) return;
    collapseInteraction(activeSeat.controller === 'computer'
      ? 'Computer activation in progress.'
      : 'Select one of your formations on the board.');
  }, [activeSeat.controller, boardState.activeSeat, boardState.pieces, collapseInteraction, combatRolling, humanActivation, mode, selectedPieceId]);

  useEffect(() => {
    const onMapClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const pieceId = readMapPieceId(target);
      if (pieceId) {
        selectFormation(pieceId);
        return;
      }

      if (modeRef.current !== 'move' || !selectedPieceIdRef.current || !target.closest('.territory, .territory-hit-target')) return;
      window.requestAnimationFrame(() => {
        const heading = document.querySelector<HTMLElement>('.map-context-panel .territory-card h3')?.textContent;
        const spaceId = spaceIdForTerritoryLabel(heading);
        if (spaceId) destinationIntentRef.current(spaceId);
      });
    };

    document.addEventListener('click', onMapClick, true);
    return () => document.removeEventListener('click', onMapClick, true);
  }, [selectFormation]);

  useEffect(() => {
    const markers = [...document.querySelectorAll(MAP_PIECE_SELECTOR)];
    for (const marker of markers) {
      const selected = readMapPieceId(marker) === selectedPieceId;
      marker.classList.toggle('bg4c-board-selected', selected);
      if (selected) marker.setAttribute('aria-pressed', 'true');
      else marker.removeAttribute('aria-pressed');
    }

    return () => {
      for (const marker of markers) {
        marker.classList.remove('bg4c-board-selected');
        marker.removeAttribute('aria-pressed');
      }
    };
  }, [selectedPieceId]);

  useEffect(() => {
    const legal = new Set(mode === 'move' ? legalMoveDestinations.map(destination => destination.spaceId) : []);
    const blocked = new Set(mode === 'move' ? blockedMoveDestinations.map(destination => destination.spaceId) : []);
    const labels = [...document.querySelectorAll<SVGGElement>('.map-label')];

    for (const label of labels) {
      const centre = label.querySelector('.territory-centre-label')?.textContent;
      const spaceId = spaceIdForTerritoryLabel(centre);
      label.classList.toggle('bg4c-move-legal', Boolean(spaceId && legal.has(spaceId)));
      label.classList.toggle('bg4c-move-blocked', Boolean(spaceId && blocked.has(spaceId)));
      label.classList.toggle('bg4c-move-preview', Boolean(spaceId && mode === 'move' && spaceId === pendingDestinationSpaceId));
    }

    return () => {
      for (const label of labels) {
        label.classList.remove('bg4c-move-legal', 'bg4c-move-blocked', 'bg4c-move-preview');
      }
    };
  }, [blockedMoveDestinations, legalMoveDestinations, mode, pendingDestinationSpaceId]);

  useEffect(() => {
    let retryTimer: number | null = null;
    let attachedMap: TerrainMapHandle | null = null;

    const onTerrainTerritoryClick = (event: TerrainMapClickEvent) => {
      if (modeRef.current !== 'move' || !selectedPieceIdRef.current) return;
      const territoryId = event.features?.[0]?.properties?.territory_id;
      if (typeof territoryId === 'string') destinationIntentRef.current(territoryId);
    };

    const attach = () => {
      const map = (window as unknown as { __r3TerrainMap?: TerrainMapHandle }).__r3TerrainMap;
      if (!map || !map.isStyleLoaded() || !map.getSource(TERRAIN_SOURCE_ID) || !map.getLayer(TERRAIN_CLICK_LAYER_ID)) {
        retryTimer = window.setTimeout(attach, 150);
        return;
      }

      attachedMap = map;
      terrainMapRef.current = map;
      ensureTerrainMoveLayers(map);
      map.on('click', TERRAIN_CLICK_LAYER_ID, onTerrainTerritoryClick);
      applyTerrainMoveHighlights(map, moveVisualRef.current);
    };

    retryTimer = window.setTimeout(attach, 0);
    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (!attachedMap) return;
      try {
        attachedMap.off('click', TERRAIN_CLICK_LAYER_ID, onTerrainTerritoryClick);
        clearTerrainMoveHighlights(attachedMap, moveVisualRef.current.boardSpaceIds);
        if (attachedMap.getLayer(BG12H_MOVE_OUTLINE_LAYER_ID)) attachedMap.removeLayer(BG12H_MOVE_OUTLINE_LAYER_ID);
        if (attachedMap.getLayer(BG12H_MOVE_FILL_LAYER_ID)) attachedMap.removeLayer(BG12H_MOVE_FILL_LAYER_ID);
      } catch {
        // The protected terrain renderer may already have disposed its MapLibre instance.
      }
      if (terrainMapRef.current === attachedMap) terrainMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = terrainMapRef.current;
    if (!map) return;
    applyTerrainMoveHighlights(map, movementVisual);
  }, [movementVisual]);

  useEffect(() => {
    if (mode !== 'attack' || !selectedPieceId) return;
    let attempts = 0;
    let timer: number | null = null;

    const bindAttacker = () => {
      const select = document.querySelector<HTMLSelectElement>('.bg12h-contextual-combat .tabletop-combat-attacker select');
      if (select) {
        if (select.value !== selectedPieceId) {
          select.value = selectedPieceId;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      attempts += 1;
      if (attempts < 12) timer = window.setTimeout(bindAttacker, 40);
    };

    timer = window.setTimeout(bindAttacker, 0);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [mode, selectedPieceId]);

  useEffect(() => {
    const onDiceClatter = (event: Event) => {
      if (modeRef.current !== 'attack') return;
      const detail = (event as CustomEvent<{ phase?: string }>).detail;
      if (detail?.phase === 'start') {
        clearCompletionTimer();
        setCombatRolling(true);
        return;
      }
      if (detail?.phase !== 'settled') return;

      setCombatRolling(false);
      setFeedback('Combat resolved. Returning to the board.');
      clearCompletionTimer();
      completionTimerRef.current = window.setTimeout(() => {
        if (modeRef.current === 'attack') collapseInteraction('Combat resolved. Select a formation for the next action.');
      }, 1100);
    };

    window.addEventListener('future-conquest:dice-clatter', onDiceClatter);
    return () => window.removeEventListener('future-conquest:dice-clatter', onDiceClatter);
  }, [clearCompletionTimer, collapseInteraction]);

  const chooseMode = (nextMode: FormationMode) => {
    if (!selectedPieceId || !humanActivation) return;
    setMode(nextMode);
    setPendingDestinationSpaceId(null);
    setPendingSupportAction(null);

    if (nextMode === 'move') setFeedback('Move: choose a highlighted destination directly on the board.');
    if (nextMode === 'attack') setFeedback('Attack: choose an adjacent enemy contact directly on the board.');
    if (nextMode === 'support') setFeedback('Support: choose Recover, Engineer or Logistics, then confirm.');
    if (nextMode === 'pass') setFeedback('Pass this activation without spending a Command Action?');
  };

  const returnToActions = () => {
    if (combatRolling) return;
    setMode(null);
    setPendingDestinationSpaceId(null);
    setPendingSupportAction(null);
    setFeedback(selectedPieceId
      ? `${selectedPieceId} remains selected. Choose an action.`
      : 'Select one of your formations on the board.');
  };

  const confirmMove = () => {
    if (!selectedPieceId || !pendingDestinationSpaceId) return;
    const result = dispatchBoardAction({
      type: 'move-piece',
      pieceId: selectedPieceId,
      destinationSpaceId: pendingDestinationSpaceId
    });
    if (!result.accepted) {
      setFeedback(result.reason);
      return;
    }
    collapseInteraction(`${result.reason} Select a formation for the next action.`);
  };

  const confirmSupport = () => {
    if (!selectedPieceId || !pendingSupportAction) return;
    const result = dispatchBoardAction({ type: pendingSupportAction, pieceId: selectedPieceId });
    if (!result.accepted) {
      setFeedback(result.reason);
      setPendingSupportAction(null);
      return;
    }
    collapseInteraction(`${result.reason} Select a formation for the next action.`);
  };

  const confirmPass = () => {
    const result = dispatchBoardAction({ type: 'pass-activation' });
    if (!result.accepted) {
      setFeedback(result.reason);
      return;
    }
    collapseInteraction(`${result.reason} Select a formation when the next human activation begins.`);
  };

  const selectedSupportPreview = pendingSupportAction
    ? supportPreviews.find(action => action.type === pendingSupportAction)
    : null;
  const actionStatus = !humanActivation
    ? activeSeat.controller === 'computer' ? 'Computer turn' : boardState.phase
    : !selectedPieceId
      ? 'Choose formation'
      : mode === 'move'
        ? 'Move'
        : mode === 'attack'
          ? combatRolling ? 'Rolling 2D6' : 'Attack'
          : mode === 'support'
            ? 'Support'
            : mode === 'pass'
              ? 'Pass'
              : 'Choose action';

  return <section
    className="bg12h-formation-interaction"
    aria-label="Formation actions"
    data-bg-package="BG12H"
    data-action-mode={mode ?? 'select'}
    data-selected-piece={selectedPieceId ?? ''}
  >
    <header className="bg12h-formation-heading">
      <div>
        <span>Formation actions</span>
        <strong>{actionStatus}</strong>
      </div>
      {selectedPieceId && !combatRolling && <button type="button" className="bg12h-clear-selection" onClick={() => collapseInteraction('Selection cleared. Choose a formation on the board.')}>Clear</button>}
    </header>

    {!humanActivation && <p className="bg12h-selection-prompt">
      {activeSeat.controller === 'computer'
        ? 'Computer activation in progress. The board will return to formation actions on the next human activation.'
        : `Board actions resume during the activation phase. Current phase: ${boardState.phase}.`}
    </p>}

    {humanActivation && !selectedPiece && <div className="bg12h-selection-prompt">
      <strong>Select a formation on the board</strong>
      <span>Its legal actions will appear here. The board remains the primary interaction surface.</span>
    </div>}

    {selectedPiece && <>
      <div className="bg12h-selected-formation" aria-label={`${selectedPiece.id} selected`}>
        <div>
          <small>Selected formation</small>
          <strong>{selectedPiece.id}</strong>
          <span>{territoryLabel(selectedPiece.spaceId)}</span>
        </div>
        <dl>
          <div><dt>Readiness</dt><dd>{selectedPiece.readiness}</dd></div>
          <div><dt>Damage</dt><dd>{selectedPiece.damage}/3</dd></div>
          <div><dt>Supply</dt><dd>{selectedPiece.supply}</dd></div>
        </dl>
      </div>

      {!mode && <div className="bg12h-action-row" aria-label="Choose formation action">
        <button
          type="button"
          disabled={legalMoveDestinations.length === 0}
          title={legalMoveDestinations.length ? `${legalMoveDestinations.length} legal Move destination${legalMoveDestinations.length === 1 ? '' : 's'}` : 'No legal adjacent Move destination'}
          onClick={() => chooseMode('move')}
        >Move</button>
        <button
          type="button"
          disabled={combatTargets.length === 0}
          title={combatTargets.length ? `${combatTargets.length} legal adjacent combat target${combatTargets.length === 1 ? '' : 's'}` : 'No legal adjacent combat target'}
          onClick={() => chooseMode('attack')}
        >Attack</button>
        <button
          type="button"
          disabled={!supportAvailable}
          title={supportAvailable ? 'At least one support action is legal' : supportPreviews.map(action => `${action.label}: ${action.preview?.reason ?? 'Unavailable'}`).join(' · ')}
          onClick={() => chooseMode('support')}
        >Support</button>
        <button
          type="button"
          disabled={!passPreview.accepted}
          title={passPreview.reason}
          onClick={() => chooseMode('pass')}
        >Pass</button>
      </div>}

      {mode === 'move' && <section className="bg12h-action-detail" aria-label="Move action">
        <div className="bg12h-action-detail-heading">
          <div><strong>Move</strong><span>{legalMoveDestinations.length} legal destination{legalMoveDestinations.length === 1 ? '' : 's'}</span></div>
          <button type="button" onClick={returnToActions}>Cancel</button>
        </div>
        <p>Choose a highlighted destination directly on the board.</p>

        <details className="bg12h-accessible-fallback">
          <summary>Destination list</summary>
          {legalMoveDestinations.map(destination => <button
            key={destination.spaceId}
            type="button"
            className={destination.spaceId === pendingDestinationSpaceId ? 'selected' : ''}
            onClick={() => handleDestinationIntent(destination.spaceId)}
          >{territoryLabel(destination.spaceId)}</button>)}
          {blockedMoveDestinations.length > 0 && <ul>
            {blockedMoveDestinations.map(destination => <li key={destination.spaceId}>
              <b>{territoryLabel(destination.spaceId)}</b> — {destination.reason ?? 'Unavailable'}
            </li>)}
          </ul>}
        </details>

        {pendingDestinationSpaceId && <div className="bg12h-confirm-card" aria-label="Move confirmation">
          <span>{territoryLabel(selectedPiece.spaceId)}</span>
          <b aria-hidden="true">→</b>
          <strong>{territoryLabel(pendingDestinationSpaceId)}</strong>
          <small>1 Command Action</small>
          <div>
            <button type="button" className="confirm" onClick={confirmMove}>Confirm Move</button>
            <button type="button" onClick={() => setPendingDestinationSpaceId(null)}>Choose another</button>
          </div>
        </div>}
      </section>}

      {mode === 'attack' && <section className="bg12h-action-detail bg12h-contextual-combat" aria-label="Attack action">
        <div className="bg12h-action-detail-heading">
          <div><strong>Attack</strong><span>{combatTargets.length} legal target{combatTargets.length === 1 ? '' : 's'}</span></div>
          <button type="button" disabled={combatRolling} onClick={returnToActions}>{combatRolling ? 'Rolling…' : 'Cancel'}</button>
        </div>
        <p>Choose an adjacent enemy contact on the board. The accepted 2D6 tray resolves the authoritative result.</p>
        <TabletopCombatPanel />
      </section>}

      {mode === 'support' && <section className="bg12h-action-detail" aria-label="Support action">
        <div className="bg12h-action-detail-heading">
          <div><strong>Support</strong><span>1 Command Action</span></div>
          <button type="button" onClick={returnToActions}>Cancel</button>
        </div>
        <div className="bg12h-support-actions">
          {supportPreviews.map(action => <button
            key={action.type}
            type="button"
            disabled={!action.preview?.accepted}
            className={pendingSupportAction === action.type ? 'selected' : ''}
            title={action.preview?.reason ?? 'Unavailable'}
            onClick={() => {
              setPendingSupportAction(action.type);
              setFeedback(`${action.label} selected for ${selectedPiece.id}. Confirm to spend 1 Command Action.`);
            }}
          >
            <strong>{action.label}</strong>
            <small>{action.preview?.accepted ? 'Available' : action.preview?.reason ?? 'Unavailable'}</small>
          </button>)}
        </div>
        {selectedSupportPreview && <div className="bg12h-confirm-card" aria-label="Support confirmation">
          <span>{selectedSupportPreview.label}</span>
          <strong>{selectedPiece.id}</strong>
          <small>{selectedSupportPreview.preview?.reason}</small>
          <div>
            <button type="button" className="confirm" onClick={confirmSupport}>Confirm {selectedSupportPreview.label}</button>
            <button type="button" onClick={() => setPendingSupportAction(null)}>Choose another</button>
          </div>
        </div>}
      </section>}

      {mode === 'pass' && <section className="bg12h-action-detail" aria-label="Pass activation confirmation">
        <div className="bg12h-action-detail-heading">
          <div><strong>Pass</strong><span>No Command Action cost</span></div>
          <button type="button" onClick={returnToActions}>Cancel</button>
        </div>
        <div className="bg12h-confirm-card">
          <span>Yield the current activation?</span>
          <strong>{activeSeat.id}</strong>
          <small>{passPreview.reason}</small>
          <div>
            <button type="button" className="confirm" disabled={!passPreview.accepted} onClick={confirmPass}>Confirm Pass</button>
            <button type="button" onClick={returnToActions}>Keep acting</button>
          </div>
        </div>
      </section>}
    </>}

    <p className="bg12h-feedback" role="status" aria-live="polite">{feedback}</p>
  </section>;
}
