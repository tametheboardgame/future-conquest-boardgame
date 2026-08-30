import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyBoardAction, getBoardMoveDestinations } from '../game/board-state';
import { TERRITORIES } from '../game/data';
import { useBoardGameDispatch, useBoardGameState } from './BoardGameStateProvider';
import '../bg4-map-movement.css';

type ActivationSnapshot = {
  visible: boolean;
  formation: string;
  target: string;
};

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

const EMPTY: ActivationSnapshot = {
  visible: false,
  formation: 'Select a formation',
  target: 'Select a highlighted region'
};

const TERRAIN_SOURCE_ID = 'campaign-territories';
const TERRAIN_CLICK_LAYER_ID = 'campaign-territories-fill';
const TERRAIN_STATE_OUTLINE_LAYER_ID = 'campaign-state-outline';
const BG4C_MOVE_FILL_LAYER_ID = 'bg4c-move-destinations-fill';
const BG4C_MOVE_OUTLINE_LAYER_ID = 'bg4c-move-destinations-outline';
const MAP_PIECE_SELECTOR = '.r3-terrain-task-group-marker[data-group-id], .task-group-marker';

function readActivationSnapshot(): ActivationSnapshot {
  const contextPanel = document.querySelector<HTMLElement>('.map-context-panel');
  if (!contextPanel) return EMPTY;

  const formationSelect = contextPanel.querySelector<HTMLSelectElement>('.quick-command select');
  const formation = formationSelect?.selectedOptions[0]?.textContent?.trim() || 'Select a formation';
  const territoryHeading = contextPanel.querySelector<HTMLElement>('.territory-card h3')?.textContent?.trim();

  return {
    visible: true,
    formation,
    target: territoryHeading && territoryHeading !== 'No territory selected'
      ? territoryHeading
      : 'Select a highlighted region'
  };
}

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
  if (!map.getLayer(BG4C_MOVE_FILL_LAYER_ID)) {
    map.addLayer({
      id: BG4C_MOVE_FILL_LAYER_ID,
      type: 'fill',
      source: TERRAIN_SOURCE_ID,
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'bg4cPreview'], false], '#f2cf72',
          ['boolean', ['feature-state', 'bg4cLegal'], false], '#65d8b2',
          ['boolean', ['feature-state', 'bg4cBlocked'], false], '#d46d68',
          '#000000'
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'bg4cPreview'], false], 0.34,
          ['boolean', ['feature-state', 'bg4cLegal'], false], 0.2,
          ['boolean', ['feature-state', 'bg4cBlocked'], false], 0.11,
          0
        ]
      }
    }, TERRAIN_STATE_OUTLINE_LAYER_ID);
  }

  if (!map.getLayer(BG4C_MOVE_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: BG4C_MOVE_OUTLINE_LAYER_ID,
      type: 'line',
      source: TERRAIN_SOURCE_ID,
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'bg4cPreview'], false], '#ffe39a',
          ['boolean', ['feature-state', 'bg4cLegal'], false], '#8ffff1',
          ['boolean', ['feature-state', 'bg4cBlocked'], false], '#ec8a82',
          '#000000'
        ],
        'line-opacity': [
          'case',
          ['any',
            ['boolean', ['feature-state', 'bg4cPreview'], false],
            ['boolean', ['feature-state', 'bg4cLegal'], false],
            ['boolean', ['feature-state', 'bg4cBlocked'], false]
          ],
          0.94,
          0
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'bg4cPreview'], false], 3.3,
          ['boolean', ['feature-state', 'bg4cLegal'], false], 2.5,
          ['boolean', ['feature-state', 'bg4cBlocked'], false], 1.8,
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
      bg4cLegal: legal.has(spaceId),
      bg4cBlocked: blocked.has(spaceId),
      bg4cPreview: visual.previewSpaceId === spaceId
    });
  }
}

function clearTerrainMoveHighlights(map: TerrainMapHandle, spaceIds: string[]) {
  for (const spaceId of spaceIds) {
    map.setFeatureState({ source: TERRAIN_SOURCE_ID, id: spaceId }, {
      bg4cLegal: false,
      bg4cBlocked: false,
      bg4cPreview: false
    });
  }
}

/**
 * BG4C turns retained map pieces into the authoritative Move interaction.
 * The UI only asks BG4B for destination legality and rejection reasons; the
 * confirmed move is still executed by the shared board dispatcher. BG5 combat
 * is owned separately by the authoritative board-combat path.
 */
export function TabletopActivationPanel() {
  const [snapshot, setSnapshot] = useState<ActivationSnapshot>(EMPTY);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [pendingDestinationSpaceId, setPendingDestinationSpaceId] = useState<string | null>(null);
  const [moveFeedback, setMoveFeedback] = useState('Select one of your formation pieces on the map to plan a Move.');
  const boardState = useBoardGameState();
  const dispatchBoardAction = useBoardGameDispatch();
  const activeSeat = boardState.seats[boardState.activeSeat];
  const passPreview = applyBoardAction(boardState, { type: 'pass-activation' });
  const canPass = activeSeat.controller === 'human' && passPreview.accepted;
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

  const terrainMapRef = useRef<TerrainMapHandle | null>(null);
  const moveVisualRef = useRef<MoveVisualState>({
    boardSpaceIds: [],
    legalSpaceIds: [],
    blockedSpaceIds: [],
    previewSpaceId: null
  });

  const selectBoardPiece = useCallback((pieceId: string) => {
    if (activeSeat.controller !== 'human') {
      setMoveFeedback('Direct movement is unavailable during a computer activation.');
      return;
    }
    if (boardState.phase !== 'activation') {
      setMoveFeedback(`Movement is unavailable during the ${boardState.phase} phase.`);
      return;
    }

    const piece = boardState.pieces[pieceId];
    if (!piece) {
      setMoveFeedback(`Unknown board piece: ${pieceId}.`);
      return;
    }
    if (piece.seatId !== boardState.activeSeat) {
      setMoveFeedback(`${pieceId} is not controlled by the active seat.`);
      return;
    }

    const origin = piece.spaceId ? boardState.spaces[piece.spaceId] : undefined;
    const adjacent = getBoardMoveDestinations(boardState, pieceId)
      .filter(destination => origin?.adjacentSpaceIds.includes(destination.spaceId));
    const legalCount = adjacent.filter(destination => destination.legal).length;

    setSelectedPieceId(pieceId);
    setPendingDestinationSpaceId(null);
    setMoveFeedback(legalCount > 0
      ? `${pieceId} selected. Choose one of ${legalCount} highlighted legal destinations.`
      : `${pieceId} selected. It currently has no legal adjacent Move destination; blocked regions explain why.`);
  }, [activeSeat.controller, boardState]);

  const handleDestinationIntent = useCallback((spaceId: string) => {
    if (!selectedPieceId) {
      setMoveFeedback('Select one of your formation pieces before choosing a destination.');
      return;
    }

    const evaluation = moveDestinations.find(destination => destination.spaceId === spaceId);
    if (!evaluation) {
      setMoveFeedback(`Unknown destination space: ${spaceId}.`);
      return;
    }
    if (!evaluation.legal) {
      setPendingDestinationSpaceId(null);
      setMoveFeedback(evaluation.reason ?? `${territoryLabel(spaceId)} is unavailable.`);
      return;
    }

    setPendingDestinationSpaceId(spaceId);
    setMoveFeedback(`Previewing ${selectedPieceId} to ${territoryLabel(spaceId)}. Confirm to spend 1 Command Action.`);
  }, [moveDestinations, selectedPieceId]);

  const destinationIntentRef = useRef(handleDestinationIntent);
  destinationIntentRef.current = handleDestinationIntent;

  const movementVisual = useMemo<MoveVisualState>(() => ({
    boardSpaceIds: Object.keys(boardState.spaces),
    legalSpaceIds: legalMoveDestinations.map(destination => destination.spaceId),
    blockedSpaceIds: blockedMoveDestinations.map(destination => destination.spaceId),
    previewSpaceId: pendingDestinationSpaceId
  }), [boardState.spaces, blockedMoveDestinations, legalMoveDestinations, pendingDestinationSpaceId]);
  moveVisualRef.current = movementVisual;

  useEffect(() => {
    let frame: number | null = null;
    const sync = () => {
      frame = null;
      setSnapshot(readActivationSnapshot());
    };
    const scheduleSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    document.addEventListener('click', scheduleSync, true);
    document.addEventListener('change', scheduleSync, true);
    document.addEventListener('keyup', scheduleSync, true);
    return () => {
      document.removeEventListener('click', scheduleSync, true);
      document.removeEventListener('change', scheduleSync, true);
      document.removeEventListener('keyup', scheduleSync, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!selectedPieceId) return;
    const piece = boardState.pieces[selectedPieceId];
    if (boardState.phase === 'activation' && piece?.seatId === boardState.activeSeat) return;
    setSelectedPieceId(null);
    setPendingDestinationSpaceId(null);
  }, [boardState.activeSeat, boardState.phase, boardState.pieces, selectedPieceId]);

  useEffect(() => {
    const onMapClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const pieceId = readMapPieceId(target);
      if (pieceId) {
        selectBoardPiece(pieceId);
        return;
      }

      if (!selectedPieceId || !target.closest('.territory, .territory-hit-target')) return;
      window.requestAnimationFrame(() => {
        const heading = document.querySelector<HTMLElement>('.map-context-panel .territory-card h3')?.textContent;
        const spaceId = spaceIdForTerritoryLabel(heading);
        if (spaceId) destinationIntentRef.current(spaceId);
      });
    };

    document.addEventListener('click', onMapClick, true);
    return () => document.removeEventListener('click', onMapClick, true);
  }, [selectBoardPiece, selectedPieceId]);

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
  }, [selectedPieceId, snapshot.formation]);

  useEffect(() => {
    const legal = new Set(legalMoveDestinations.map(destination => destination.spaceId));
    const blocked = new Set(blockedMoveDestinations.map(destination => destination.spaceId));
    const labels = [...document.querySelectorAll<SVGGElement>('.map-label')];

    for (const label of labels) {
      const centre = label.querySelector('.territory-centre-label')?.textContent;
      const spaceId = spaceIdForTerritoryLabel(centre);
      label.classList.toggle('bg4c-move-legal', Boolean(spaceId && legal.has(spaceId)));
      label.classList.toggle('bg4c-move-blocked', Boolean(spaceId && blocked.has(spaceId)));
      label.classList.toggle('bg4c-move-preview', Boolean(spaceId && spaceId === pendingDestinationSpaceId));
    }

    return () => {
      for (const label of labels) {
        label.classList.remove('bg4c-move-legal', 'bg4c-move-blocked', 'bg4c-move-preview');
      }
    };
  }, [blockedMoveDestinations, legalMoveDestinations, pendingDestinationSpaceId, snapshot.target]);

  useEffect(() => {
    let retryTimer: number | null = null;
    let attachedMap: TerrainMapHandle | null = null;

    const onTerrainTerritoryClick = (event: TerrainMapClickEvent) => {
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
        if (attachedMap.getLayer(BG4C_MOVE_OUTLINE_LAYER_ID)) attachedMap.removeLayer(BG4C_MOVE_OUTLINE_LAYER_ID);
        if (attachedMap.getLayer(BG4C_MOVE_FILL_LAYER_ID)) attachedMap.removeLayer(BG4C_MOVE_FILL_LAYER_ID);
      } catch {
        // The terrain renderer may already have disposed its MapLibre instance.
      }
      if (terrainMapRef.current === attachedMap) terrainMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = terrainMapRef.current;
    if (!map) return;
    applyTerrainMoveHighlights(map, movementVisual);
  }, [movementVisual]);

  if (!snapshot.visible) return null;

  const confirmMove = () => {
    if (!selectedPieceId || !pendingDestinationSpaceId) return;
    const result = dispatchBoardAction({
      type: 'move-piece',
      pieceId: selectedPieceId,
      destinationSpaceId: pendingDestinationSpaceId
    });
    setMoveFeedback(result.reason);
    if (!result.accepted) return;
    setSelectedPieceId(null);
    setPendingDestinationSpaceId(null);
  };

  const cancelMove = () => {
    setPendingDestinationSpaceId(null);
    setMoveFeedback(selectedPieceId
      ? `${selectedPieceId} remains selected. Choose another highlighted destination.`
      : 'Move preview cancelled.');
  };

  const passActivation = () => {
    const result = dispatchBoardAction({ type: 'pass-activation' });
    setMoveFeedback(result.reason);
    if (!result.accepted) return;
    setSelectedPieceId(null);
    setPendingDestinationSpaceId(null);
  };

  const status = activeSeat.controller === 'computer'
    ? 'Computer turn'
    : pendingDestinationSpaceId
      ? 'Confirm move'
      : selectedPieceId
        ? 'Choose destination'
        : 'Choose piece';

  return <aside
    className="tabletop-activation-panel"
    aria-label="Current activation"
    data-bg-package="BG3E"
    data-bg-movement="BG4C"
  >
    <header>
      <span>Current Activation</span>
      <strong>{status}</strong>
    </header>

    <div className="tabletop-activation-piece">
      <small>Formation</small>
      <b>{selectedPieceId ?? snapshot.formation}</b>
      <small>Position</small>
      <b>{selectedPiece ? territoryLabel(selectedPiece.spaceId) : 'Select a piece on the map'}</b>
    </div>

    {selectedPieceId && <section className="tabletop-move-destinations" aria-label="Move destinations">
      <div className="tabletop-move-heading">
        <strong>Move destinations</strong>
        <span>{legalMoveDestinations.length} legal</span>
      </div>

      {legalMoveDestinations.length > 0
        ? <div className="tabletop-move-destination-list">
          {legalMoveDestinations.map(destination => <button
            key={destination.spaceId}
            type="button"
            className={destination.spaceId === pendingDestinationSpaceId ? 'legal preview' : 'legal'}
            onClick={() => handleDestinationIntent(destination.spaceId)}
          >
            <span>{territoryLabel(destination.spaceId)}</span>
            <small>Legal · 1 Command Action</small>
          </button>)}
        </div>
        : <p className="tabletop-move-empty">No legal adjacent Move destination.</p>}

      {blockedMoveDestinations.length > 0 && <details className="tabletop-move-blocked-list">
        <summary>{blockedMoveDestinations.length} unavailable adjacent {blockedMoveDestinations.length === 1 ? 'region' : 'regions'}</summary>
        {blockedMoveDestinations.map(destination => <button
          key={destination.spaceId}
          type="button"
          className="blocked"
          onClick={() => handleDestinationIntent(destination.spaceId)}
        >
          <span>{territoryLabel(destination.spaceId)}</span>
          <small>{destination.reason ?? 'Unavailable'}</small>
        </button>)}
      </details>}
    </section>}

    {selectedPieceId && pendingDestinationSpaceId && <section className="tabletop-move-preview" aria-label="Move preview">
      <strong>Move preview</strong>
      <span>{territoryLabel(selectedPiece?.spaceId)}</span>
      <b aria-hidden="true">→</b>
      <span>{territoryLabel(pendingDestinationSpaceId)}</span>
      <small>Cost: 1 Command Action</small>
      <div>
        <button type="button" className="confirm" onClick={confirmMove}>Confirm Move</button>
        <button type="button" onClick={cancelMove}>Cancel</button>
      </div>
    </section>}

    <p className="tabletop-move-feedback" role="status">{moveFeedback}</p>

    <div className="tabletop-activation-actions" aria-label="Activation actions">
      <button type="button" disabled={!canPass} title={canPass ? 'Yield this activation without spending a Command Action' : passPreview.reason} onClick={passActivation}>Pass Activation</button>
    </div>

    <div className="tabletop-later-actions" aria-label="Later board game actions">
      <span>Recover</span><span>Engineer</span><span>Logistics</span>
    </div>
    <p>Move is map-driven through the authoritative board dispatcher. Combat is handled separately by the authoritative dice-combat controls.</p>
  </aside>;
}
