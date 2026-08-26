import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CommandNavigation, type CommandView } from './components/CommandNavigation';
import { ForceOrganisationPanel } from './components/ForceOrganisationPanel';
import { FormationRoster } from './components/FormationRoster';
import { InfrastructureCommand } from './components/InfrastructureCommand';
import { LogisticsCommand } from './components/LogisticsCommand';
import { DefencePanel } from './components/DefencePanel';
import { CombatAfterActionAlert, CombatReportsPanel } from './components/CombatReports';
import { StrategicCollapseDecision } from './components/StrategicCollapseDecision';
import { TutorialOverlay } from './components/TutorialOverlay';
import { useLiveGlobalSettings } from './components/StartupExperience';
import { useBoardGameState } from './components/BoardGameStateProvider';
import { MapView } from './components/MapView';
import { loadTerrainMapModule, prewarmTerrainMapModule } from './presentation/r3-terrain-loader';

const TerrainMapPrototype = lazy(() => loadTerrainMapModule().then(module => ({ default: module.TerrainMapPrototype })));
import { TERRAIN_LABELS, TERRITORIES } from './game/data';
import { STRATEGIC_ROUTE_BY_ID } from './game/strategic-network-data';
import { NODE_TYPE_LABELS, ROUTE_TYPE_LABELS, nodesForTerritory, routeStatusLabel, routesForTerritory } from './game/strategic-network';
import { estimateRouteMovementDays } from './game/route-movement';
import { SUPPLY_CONDITION_LABELS } from './game/supply-network';
import { applyBoardProjectionToRendererState } from './game/board-state-render-integration';
import { projectBoardStateForRenderer } from './game/board-state-render-projection';
import {
  getEnemyContacts,
  getAdviserWarnings,
  getSupplyClarity,
  getThreatenedTerritories,
  getTutorialStep,
  markSupplyWarningAcknowledged,
  moveTutorial,
  progressTutorial,
  requiresSupplyAcknowledgement,
  restartTutorial,
  skipTutorial,
  TUTORIAL_STEPS
} from './game/operational-clarity';
import {
  beginOperation,
  canIssueOperationalOrder,
  continueCampaignAfterCollapse,
  endTurn,
  getOperationAtTarget,
  getOperationForGroup,
  issueMove,
  loadGame,
  newGame,
  saveGame,
  selectTaskGroup,
  selectTaskGroupForNavigation,
  selectTerritory,
  setGarrison,
  strategicCollapseDecisionPending,
  surrenderCampaign
} from './game/engine';
import { occupationRequirement } from './game/formation-organisation';
import { getTerritoryResourceState, logisticsHubUpgradeQuote, TERRITORY_RESOURCES, upgradeLogisticsHub } from './game/territory-resources';
import { getEscalationStage } from './game/strategic-response';
import { getAdjacentOrderTargets, getOrderTargetInfo } from './game/order-targeting';
import type { Difficulty, GameState, Operation } from './game/types';
import { inspectCampaignSlot, writeCampaignSlot } from './game/persistence';
import { getBrowserStorage, showPersistenceFailure } from './persistence-feedback';
import { resolveContextualTarget, revalidateNavigationContext, type ContextualTarget, type ResolvedContextualTarget } from './game/contextual-navigation';

const formatNumber = (value: number) => new Intl.NumberFormat('en-GB').format(value);
const operationTitle = (operation: Operation) => `Operation ${TERRITORIES[operation.target].centre}`;
const MOVEMENT_RESOLUTION_BEAT_MS = 1750;
const MOVEMENT_RESOLUTION_REDUCED_MS = 120;
type MovementResolutionState = { phase: 'arming' | 'playing'; next: GameState; reducedMotion: boolean };

export default function App() {
  const { assistanceLevel, autosaveEnabled } = useLiveGlobalSettings();
  const boardState = useBoardGameState();
  const [state, setState] = useState<GameState>(() => newGame());
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>('standard');
  const [currentView, setCurrentView] = useState<CommandView>('map');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [showSupplyWarning, setShowSupplyWarning] = useState(false);
  const [newTutorialEnabled, setNewTutorialEnabled] = useState(true);
  const [navigationContext, setNavigationContext] = useState<ResolvedContextualTarget | null>(null);
  const [movementResolution, setMovementResolution] = useState<MovementResolutionState | null>(null);
  const movementResolutionLockRef = useRef(false);
  // Terrain is the production renderer. Only the explicit accessibility and
  // diagnostics override opts out; the terrain host still owns compact/WebGL
  // capability detection and falls back to SVG if initialisation fails.
  const terrainPrototypeRequested = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('terrain') !== '0';
  const [terrainPrototypeFailed, setTerrainPrototypeFailed] = useState(false);
  const [terrainPrototypeFailureReason, setTerrainPrototypeFailureReason] = useState('');

  useEffect(() => {
    if (terrainPrototypeRequested) prewarmTerrainMapModule();
  }, [terrainPrototypeRequested]);

  useEffect(() => {
    setNavigationContext(current => revalidateNavigationContext(state, current));
  }, [state]);

  useEffect(() => {
    if (!movementResolution) return;
    if (movementResolution.phase === 'arming') {
      const frame = window.requestAnimationFrame(() => {
        setMovementResolution(current => current?.phase === 'arming' ? { ...current, phase: 'playing' } : current);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const delay = movementResolution.reducedMotion ? MOVEMENT_RESOLUTION_REDUCED_MS : MOVEMENT_RESOLUTION_BEAT_MS;
    const timeout = window.setTimeout(() => {
      setState(movementResolution.next);
      setMovementResolution(null);
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [movementResolution]);

  useEffect(() => {
    if (!movementResolution) movementResolutionLockRef.current = false;
  }, [state.turn, movementResolution]);

  const movementMapState: GameState = movementResolution?.phase === 'playing'
    ? { ...state, taskGroups: movementResolution.next.taskGroups }
    : state;
  const boardRenderProjection = useMemo(
    () => projectBoardStateForRenderer(boardState),
    [boardState]
  );
  const renderedMapState = useMemo(
    () => applyBoardProjectionToRendererState(movementMapState, boardRenderProjection),
    [movementMapState, boardRenderProjection]
  );

  const groups = Object.values(state.taskGroups);
  const operations = Object.values(state.operations).sort((a, b) => a.target.localeCompare(b.target));
  const combatReports = state.combatReports ?? [];
  const latestCombatReport = combatReports[0];
  const territoryDefinitions = Object.values(TERRITORIES).sort((a, b) => a.centre.localeCompare(b.centre));
  const enemyContacts = getEnemyContacts(state);
  const confirmedEnemyContacts = enemyContacts.filter(contact => contact.confidence === 'confirmed').length;
  const threatenedTerritories = getThreatenedTerritories(state);
  const supplyClarity = getSupplyClarity(state);
  const adviserWarnings = getAdviserWarnings(state, assistanceLevel);
  const tutorialStep = getTutorialStep(state.tutorial);
  const selectedGroup = state.taskGroups[state.selectedTaskGroupId] ?? groups[0] ?? null;
  const selectedGroupSupply = selectedGroup ? state.logistics.formationAllocations[selectedGroup.id] : undefined;
  const selectedOperation = selectedGroup ? getOperationForGroup(state, selectedGroup.id) : undefined;
  const selectedEngineeringProject = selectedGroup ? state.engineeringProjects.find(project => project.status === 'active' && project.assignedTaskGroupId === selectedGroup.id) : undefined;
  const selectedInterdictionMission = selectedGroup ? state.interdictionMissions.find(mission => mission.status === 'active' && mission.assignedTaskGroupId === selectedGroup.id) : undefined;
  const selected = state.selectedTerritory ? TERRITORIES[state.selectedTerritory] : null;
  const selectedTerritorySupply = selected ? state.logistics.territoryAllocations[selected.id] : undefined;
  const selectedTerritoryResources = selected ? getTerritoryResourceState(state, selected.id) : undefined;
  const selectedTerritoryProfile = selected ? TERRITORY_RESOURCES[selected.id] : undefined;
  const selectedHubQuote = selected ? logisticsHubUpgradeQuote(state, selected.id) : undefined;
  const selectedNetworkNodes = selected ? nodesForTerritory(selected.id) : [];
  const selectedNetworkRoutes = selected ? routesForTerritory(selected.id) : [];
  const selectedOpenRouteCount = selectedNetworkRoutes.filter(route => state.routeStates[route.id]?.status === 'open').length;
  const target = state.targetTerritory ? TERRITORIES[state.targetTerritory] : null;
  const targetState = target ? state.territories[target.id] : null;
  const targetOperation = target ? getOperationAtTarget(state, target.id) : undefined;
  const targetInfo = selectedGroup && target ? getOrderTargetInfo(state, target.id, selectedGroup.id) : null;
  const routeOptions = targetInfo?.availableRouteIds.flatMap(id => {
    const route = STRATEGIC_ROUTE_BY_ID[id];
    return route ? [route] : [];
  }) ?? [];
  const recommendedRouteId = targetInfo?.recommendedRouteId ?? '';
  const chosenRouteId = routeOptions.some(route => route.id === selectedRouteId) ? selectedRouteId : recommendedRouteId;
  const chosenRoute = chosenRouteId ? STRATEGIC_ROUTE_BY_ID[chosenRouteId] : undefined;
  const chosenRouteDays = selectedGroup && chosenRoute
    ? estimateRouteMovementDays(chosenRoute, state.routeStates[chosenRoute.id], selectedGroup)
    : null;
  const adjacentTargetNames = selectedGroup
    ? getAdjacentOrderTargets(state, selectedGroup.id).map(id => TERRITORIES[id].centre).join(', ')
    : '';

  const controlled = Object.values(state.territories).filter(territory => territory.controller === 'player').length;
  const unsecured = Object.values(state.territories).filter(territory => territory.controller === 'player' && territory.occupation === 'unsecured').length;
  const isolated = Object.values(state.territories).filter(territory => territory.controller === 'player' && !territory.supplied).length;
  const totalPersonnel = groups.reduce((sum, group) => sum + group.personnel, 0);
  const functionalArmour = groups.reduce((sum, group) => sum + group.functionalArmour, 0);
  const totalArmour = groups.reduce((sum, group) => sum + group.functionalArmour + group.damagedArmour, 0);
  const armourPercent = Math.round(functionalArmour / Math.max(1, totalArmour) * 100);
  const enemyPersonnel = enemyContacts.reduce((sum, contact) => sum + Math.round((contact.estimatedMin + contact.estimatedMax) / 2), 0);
  const targetContact = target ? enemyContacts.find(contact => contact.territoryId === target.id) : undefined;
  const escalationStage = getEscalationStage(state.escalation);
  const escalationLabel = escalationStage.label;
  const pendingMobilisations = [...state.mobilisations].filter(project => project.status === 'preparing').sort((a, b) => a.arrivalTurn - b.arrivalTurn);
  const activeEnemyOrders = state.enemyOrders.filter(order => order.status !== 'completed').slice(0, 8);
  const intelligenceReports = state.intelligenceReports.slice(0, 10);
  const collapseDecisionPending = strategicCollapseDecisionPending(state);
  const canOrderSelected = !collapseDecisionPending && canIssueOperationalOrder(selectedGroup ?? undefined);
  const canMove = Boolean(selectedGroup && targetInfo?.kind === 'move' && canOrderSelected && state.status === 'playing');
  const canAttack = Boolean(selectedGroup && targetInfo?.kind === 'attack' && canOrderSelected && state.status === 'playing');

  const frontlineTerritories = territoryDefinitions.filter(territory => {
    const territoryState = state.territories[territory.id];
    return territoryState.controller === 'enemy' && territory.neighbours.some(neighbour => state.territories[neighbour]?.controller === 'player');
  });
  const supplyDisruptions = territoryDefinitions.filter(territory => {
    const territoryState = state.territories[territory.id];
    return territoryState.controller === 'player' && !territoryState.supplied;
  });
  const stressedFormations = groups.filter(group => {
    const condition = state.logistics.formationAllocations[group.id]?.condition;
    return condition === 'undersupplied' || condition === 'critical' || condition === 'cut-off';
  });
  const bottleneckRoutes = state.logistics.bottleneckRouteIds.flatMap(id => STRATEGIC_ROUTE_BY_ID[id] ? [STRATEGIC_ROUTE_BY_ID[id]] : []);
  const recentAlerts = state.events.filter(event => event.tone === 'warning' || event.tone === 'danger').slice(0, 8);
  const availableGroups = groups.filter(group => canIssueOperationalOrder(group));
  const tutorialAnchorSelector = (() => {
    if (!tutorialStep) return undefined;
    if (tutorialStep.id === 'formation') {
      return currentView === 'forces' ? '[data-tutorial="formation-roster"]' : '[data-command-view="forces"]';
    }
    if (tutorialStep.id === 'operation') {
      if (currentView !== 'map') return '[data-command-view="map"]';
      return canAttack && target ? '[data-tutorial="attack-action"]' : '[data-tutorial="command-map"]';
    }
    if (tutorialStep.id === 'occupation') {
      if (currentView !== 'map') return '[data-command-view="map"]';
      const capturedGroundReady = Boolean(
        selectedGroup
        && !selectedOperation
        && !target
        && selectedGroup.location !== state.portalTerritory
        && state.territories[selectedGroup.location]?.controller === 'player'
        && selectedGroup.status !== 'garrison'
        && canOrderSelected
      );
      if (capturedGroundReady) return '[data-tutorial="garrison-action"]';
      if (operations.length > 0) return '[data-tutorial="resolve-day"]';
      return '[data-tutorial="command-map"]';
    }
    if (tutorialStep.id === 'movement') {
      if (currentView !== 'map') return '[data-command-view="map"]';
      return canMove && target ? '[data-tutorial="move-action"]' : '[data-tutorial="command-map"]';
    }
    if (tutorialStep.id === 'logistics') return '[data-command-view="logistics"]';
    if (tutorialStep.id === 'intelligence') return '[data-command-view="intelligence"]';
    return '[data-command-view="engineering"]';
  })();

  const instruction = useMemo(() => {
    if (!selectedGroup) return 'No operational task groups remain. The expedition has lost combat cohesion.';
    if (selectedOperation) {
      return `${selectedGroup.name} is committed to ${operationTitle(selectedOperation)}: ${selectedOperation.progress}% progress with ${selectedOperation.participantGroupIds.length} participating task group${selectedOperation.participantGroupIds.length === 1 ? '' : 's'}.`;
    }
    if (selectedEngineeringProject) return `${selectedGroup.name} is repairing ${STRATEGIC_ROUTE_BY_ID[selectedEngineeringProject.routeId]?.name ?? selectedEngineeringProject.routeId} at ${selectedEngineeringProject.allocation}% allocation.`;
    if (selectedInterdictionMission) return `${selectedGroup.name} is preparing an interdiction mission against ${STRATEGIC_ROUTE_BY_ID[selectedInterdictionMission.routeId]?.name ?? selectedInterdictionMission.routeId} at ${selectedInterdictionMission.intensity}% intensity.`;
    if (selectedGroup.order?.type === 'move') return `${selectedGroup.name} is moving towards ${TERRITORIES[selectedGroup.order.target].centre}. Other formations may still receive orders before the day resolves.`;
    if (selectedGroup.status === 'recovering') return `${selectedGroup.name} is recovering and cannot receive orders until the next supplied day resolves.`;
    if (targetInfo?.kind === 'route-blocked' && target) return `${target.centre} is adjacent, but every strategic corridor from ${TERRITORIES[selectedGroup.location].centre} is blocked or destroyed.`;
    if (targetInfo?.kind === 'out-of-range' && target) return `${target.centre} is outside ${selectedGroup.name}'s operational reach from ${TERRITORIES[selectedGroup.location].centre}. Available route-connected targets are marked ATTACK or MOVE.`;
    if (targetInfo?.kind === 'move' && target) return `Movement corridor selected: ${chosenRoute?.name ?? `${TERRITORIES[selectedGroup.location].centre} → ${target.centre}`}.`;
    if (targetInfo?.kind === 'attack' && targetOperation && target) return `${target.centre} already has an active operation. Review it and select Join operation to reinforce it via ${chosenRoute?.name ?? 'an available corridor'}.`;
    if (targetInfo?.kind === 'attack' && target) return `Attack target selected via ${chosenRoute?.name ?? 'an available corridor'}. Review the defenders and select Begin operation.`;
    return 'Issue independent orders to each task group, then resolve the day. Several movements and operations can run simultaneously.';
  }, [chosenRoute, selectedEngineeringProject, selectedGroup, selectedInterdictionMission, selectedOperation, target, targetInfo, targetOperation]);

  const load = () => {
    const saved = loadGame();
    if (saved) {
      setNavigationContext(null);
      setState(saved);
      setCurrentView('map');
    }
  };

  const loadAutosave = () => {
    const storage = getBrowserStorage();
    if (!storage) {
      showPersistenceFailure('The autosaved campaign could not be read. Browser storage is unavailable.');
      return;
    }
    const saved = inspectCampaignSlot(storage, 'autosave');
    if (saved.ok) {
      setNavigationContext(null);
      setState(saved.state);
      setCurrentView('map');
    } else {
      showPersistenceFailure(saved.message);
    }
  };

  const advanceDay = (current: GameState) => {
    const next = endTurn(current);
    if (autosaveEnabled) {
      const storage = getBrowserStorage();
      if (!storage) {
        showPersistenceFailure('The autosave campaign slot could not be saved. Browser storage is unavailable.');
      } else {
        const saved = writeCampaignSlot(storage, next, 'autosave');
        if (!saved.ok) showPersistenceFailure(saved.message);
      }
    }
    return next;
  };

  const beginMovementResolution = (current: GameState) => {
    if (movementResolutionLockRef.current) return;
    movementResolutionLockRef.current = true;
    const next = advanceDay(current);
    const hasVisibleMovement = Object.values(current.taskGroups).some(group => {
      const resolved = next.taskGroups[group.id];
      const order = group.order;
      if (!resolved || !order) return false;
      if (order.type === 'move') {
        return resolved.location !== group.location || resolved.order?.progress !== order.progress;
      }
      if (order.type === 'attack' && order.days === 0) {
        return resolved.location !== group.location || resolved.order?.days !== order.days || resolved.order?.type !== 'attack';
      }
      return false;
    });
    if (!hasVisibleMovement) {
      setState(next);
      return;
    }
    setNavigationContext(null);
    setCurrentView('map');
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMovementResolution({ phase: 'arming', next, reducedMotion });
  };

  const openTerritoryOnMap = (id: string) => {
    setNavigationContext(null);
    setState(current => selectTerritory(current, id));
    setCurrentView('map');
  };

  const openGroupOnMap = (id: string) => {
    setNavigationContext(null);
    setState(current => selectTaskGroup(current, id));
    setCurrentView('map');
  };

  const changeView = (view: CommandView) => {
    setNavigationContext(null);
    setCurrentView(view);
    if (view === 'logistics') setState(current => progressTutorial(current, 'open-logistics'));
    if (view === 'intelligence') setState(current => progressTutorial(current, 'review-intelligence'));
    if (view === 'engineering') setState(current => progressTutorial(current, 'open-engineering'));
  };

  const openContext = (requested: ContextualTarget) => {
    const resolved = resolveContextualTarget(state, requested);
    setNavigationContext(resolved);
    const target = resolved.target;
    if (target.kind === 'route' || target.kind === 'infrastructure') setCurrentView('engineering');
    else if (target.kind === 'formation') {
      setState(current => selectTaskGroupForNavigation(current, target.id));
      setCurrentView('forces');
    } else if (target.kind === 'territory') {
      setState(current => selectTerritory(current, target.id));
      setCurrentView('map');
    } else if (target.kind === 'operation') {
      const participant = state.operations[target.id]?.participantGroupIds[0];
      if (participant) setState(current => selectTaskGroupForNavigation(current, participant));
      setCurrentView('operations');
    } else setCurrentView('logistics');
  };

  const startCampaign = () => {
    setNavigationContext(null);
    setState(newGame(undefined, newDifficulty, newTutorialEnabled));
    setCurrentView('map');
    setShowSupplyWarning(false);
  };

  const openThreatOnMap = (territoryId: string) => {
    setNavigationContext(null);
    setState(current => selectTerritory(progressTutorial(current, 'review-intelligence'), territoryId));
    setCurrentView('map');
  };

  const resolveDay = () => {
    if (collapseDecisionPending) return;
    if (assistanceLevel !== 'Off' && requiresSupplyAcknowledgement(state) && (assistanceLevel !== 'Critical Only' || supplyClarity.severity === 'critical')) {
      setShowSupplyWarning(true);
      return;
    }
    beginMovementResolution(state);
  };

  const resolveDayAnyway = () => {
    if (collapseDecisionPending) return;
    setShowSupplyWarning(false);
    beginMovementResolution(markSupplyWarningAcknowledged(state));
  };

  const renderPriorityOrderAction = () => {
    if (!selectedGroup || !target || !targetInfo || selectedOperation || selectedGroup.order || selectedGroup.status === 'recovering') return null;
    const isAttack = targetInfo.kind === 'attack';
    const isMove = targetInfo.kind === 'move';
    if (!isAttack && !isMove) return null;

    const canExecute = isAttack ? canAttack : canMove;
    const actionLabel = isAttack ? (targetOperation ? 'Join operation' : 'Begin operation') : 'Issue movement order';
    const orderLabel = isAttack ? (targetOperation ? 'REINFORCE OPERATION' : 'ATTACK ORDER READY') : 'MOVEMENT ORDER READY';
    const execute = () => setState(current => isAttack
      ? beginOperation(current, chosenRouteId || undefined)
      : issueMove(current, chosenRouteId || undefined));

    return <div className={`priority-order-action panel ${isAttack ? 'attack' : 'move'}`} aria-label="Priority order action">
      <div className="priority-order-copy">
        <p>{orderLabel}</p>
        <strong>{selectedGroup.name} → {target.centre}</strong>
        <span>{chosenRoute?.name ?? 'No operational corridor'}{chosenRouteDays ? ` · ~${chosenRouteDays} day${chosenRouteDays === 1 ? '' : 's'}` : ''}</span>
      </div>
      {routeOptions.length > 1 && <label className="priority-route-select"><span>Corridor</span>
        <select aria-label="Priority operational corridor" value={chosenRouteId} onChange={event => setSelectedRouteId(event.target.value)}>
          {routeOptions.map(route => {
            const days = estimateRouteMovementDays(route, state.routeStates[route.id], selectedGroup);
            return <option key={route.id} value={route.id}>{route.name} · ~{days} day{days === 1 ? '' : 's'}</option>;
          })}
        </select>
      </label>}
      <button type="button" data-tutorial={isAttack ? 'attack-action' : 'move-action'} className={isAttack ? 'primary danger-action' : 'primary'} disabled={!canExecute} onClick={execute}>{actionLabel}</button>
    </div>;
  };

  const renderSelectedGroupPanel = () => <section className="selected-group selected-formation-card">
    <p className="panel-label">SELECTED FORMATION</p>
    {selectedGroup ? <>
      <h2>{selectedGroup.name}</h2>
      <p className="centre">Located at {TERRITORIES[selectedGroup.location].centre}</p>
      <dl>
        <div><dt>Personnel</dt><dd>{formatNumber(selectedGroup.personnel)} / {formatNumber(selectedGroup.maxPersonnel)}</dd></div>
        <div><dt>Functional armour</dt><dd>{formatNumber(selectedGroup.functionalArmour)}</dd></div>
        <div><dt>Damaged armour</dt><dd>{formatNumber(selectedGroup.damagedArmour)}</dd></div>
        <div><dt>Morale</dt><dd>{Math.round(selectedGroup.morale)}%</dd></div>
        <div><dt>Local supply stock</dt><dd>{Math.round(selectedGroup.supply)}%</dd></div>
        <div><dt>Delivered throughput</dt><dd>{selectedGroupSupply ? `${selectedGroupSupply.delivered} / ${selectedGroupSupply.demand}` : '—'}</dd></div>
        <div><dt>Logistics condition</dt><dd><span className={`supply-condition ${selectedGroupSupply?.condition ?? 'cut-off'}`}>{SUPPLY_CONDITION_LABELS[selectedGroupSupply?.condition ?? 'cut-off']}</span></dd></div>
        <div><dt>Status</dt><dd>{selectedGroup.status}</dd></div>
      </dl>
    </> : <><h2>No formation available</h2><p className="centre">The expedition can no longer issue operational orders.</p></>}
  </section>;

  const renderTerritoryPanel = () => <section className="territory-card">
    <p className="panel-label">MAP INTELLIGENCE</p>
    <h3>{selected?.name ?? 'No territory selected'}</h3>
    {selected && <>
      <p className="centre">Strategic centre: {selected.centre}</p>
      <dl>
        <div><dt>Terrain</dt><dd>{TERRAIN_LABELS[selected.terrain]}</dd></div>
        <div><dt>Supply value</dt><dd>{selected.supply}</dd></div>
        <div><dt>Control</dt><dd>{state.territories[selected.id].occupation}</dd></div>
        <div><dt>Supply route</dt><dd>{state.territories[selected.id].supplied ? 'connected' : 'isolated'}</dd></div>
        <div><dt>Delivered throughput</dt><dd>{selectedTerritorySupply ? `${selectedTerritorySupply.delivered} / ${selectedTerritorySupply.demand}` : '—'}</dd></div>
        <div><dt>Logistics condition</dt><dd>{selectedTerritorySupply ? SUPPLY_CONDITION_LABELS[selectedTerritorySupply.condition] : 'No allocation'}</dd></div>
        <div><dt>Fortification</dt><dd>{Math.round(state.territories[selected.id].fortification)}</dd></div>
        <div><dt>Infrastructure</dt><dd>{selectedNetworkNodes.length} nodes</dd></div>
        <div><dt>Route connections</dt><dd>{selectedOpenRouteCount} / {selectedNetworkRoutes.length} open</dd></div>
        {selectedTerritoryProfile && selectedTerritoryResources && <>
          <div><dt>Logistics hub</dt><dd>Level {selectedTerritoryResources.hubLevel} / 3</dd></div>
          <div><dt>Food</dt><dd>{selectedTerritoryProfile.food}/5 · {Math.round(selectedTerritoryResources.stocks.food)} reserve</dd></div>
          <div><dt>Industry</dt><dd>{selectedTerritoryProfile.industry}/5 · {Math.round(selectedTerritoryResources.stocks.industry)} reserve</dd></div>
          <div><dt>Energy</dt><dd>{selectedTerritoryProfile.energy}/5 · {Math.round(selectedTerritoryResources.stocks.energy)} reserve</dd></div>
          <div><dt>Transport</dt><dd>{selectedTerritoryProfile.transport}/5 · {Math.round(selectedTerritoryResources.stocks.transport)} reserve</dd></div>
          <div><dt>Medical</dt><dd>{selectedTerritoryProfile.medical}/5 · {Math.round(selectedTerritoryResources.stocks.medical)} reserve</dd></div>
          <div><dt>Military Stores</dt><dd>{selectedTerritoryProfile.militaryStores}/5 · {Math.round(selectedTerritoryResources.stocks.militaryStores)} reserve</dd></div>
        </>}
        {state.territories[selected.id].controller === 'player' && <>
          <div><dt>Legitimacy</dt><dd>{Math.round(state.territories[selected.id].legitimacy)}</dd></div>
          <div><dt>Resistance</dt><dd>{Math.round(state.territories[selected.id].resistance)}</dd></div>
        </>}
      </dl>
      {state.territories[selected.id].controller === 'player' && selectedHubQuote && <section className="hub-upgrade-control">
        <p className="network-section-heading">LOGISTICS HUB</p>
        <p>{selectedHubQuote.eligible ? `Upgrade to level ${selectedHubQuote.nextLevel}: ${selectedHubQuote.industry} Industry, ${selectedHubQuote.transport} Transport, ${selectedHubQuote.energy} Energy.` : selectedHubQuote.reason}</p>
        <button type="button" disabled={state.status !== 'playing' || !selectedHubQuote.eligible || !selectedHubQuote.affordable} onClick={() => setState(current => upgradeLogisticsHub(current, selected.id))}>{selectedTerritoryResources?.hubLevel ? 'Upgrade logistics hub' : 'Construct logistics hub'}</button>
      </section>}
      {state.territories[selected.id].controller === 'player' && <DefencePanel state={state} territoryId={selected.id} onChange={setState} />}
      <p className="network-section-heading">STRATEGIC INFRASTRUCTURE</p>
      <div className="network-node-list">{selectedNetworkNodes.map(node => <article key={node.id}><strong>{node.name}</strong><span>{NODE_TYPE_LABELS[node.type]}</span></article>)}</div>
      <p className="network-section-heading">ROUTE CONNECTIONS</p>
      <div className="network-route-list">{selectedNetworkRoutes.map(route => <article key={route.id}><strong>{route.name}</strong><span>{routeStatusLabel(state.routeStates[route.id])}</span></article>)}</div>
    </>}
  </section>;

  const renderOrdersPanel = () => <section className="operation-card" data-tutorial="formation-orders">
    <p className="panel-label">FORMATION ORDERS</p>
    {!selectedGroup ? <p>No task group is available to receive orders.</p> : selectedOperation ? <>
      <h3>{selectedGroup.name} → {TERRITORIES[selectedOperation.target].centre}</h3>
      <p>This formation is one of {selectedOperation.participantGroupIds.length} task group{selectedOperation.participantGroupIds.length === 1 ? '' : 's'} assigned to the operation.</p>
      <div className="forecast"><span>Operation progress</span><strong>{selectedOperation.progress}%</strong></div>
      <div className="forecast"><span>Days engaged</span><strong>{selectedOperation.days}</strong></div>
      <div className="forecast"><span>Enemy formations</span><strong>{selectedOperation.enemyFormationIds.length}</strong></div>
    </> : selectedGroup.order?.type === 'move' ? <>
      <h3>Movement underway</h3>
      <p>{selectedGroup.name} is moving to {TERRITORIES[selectedGroup.order.target].centre}{selectedGroup.order.routeId ? ` via ${STRATEGIC_ROUTE_BY_ID[selectedGroup.order.routeId]?.name ?? 'the assigned corridor'}` : ''}. Other task groups remain available for separate orders.</p>
      <div className="forecast"><span>Progress</span><strong>{selectedGroup.order.progress}%</strong></div>
      <div className="forecast"><span>Days travelling</span><strong>{selectedGroup.order.days}</strong></div>
    </> : selectedGroup.status === 'recovering' ? <>
      <h3>Formation recovering</h3>
      <p>{selectedGroup.name} cannot move, attack or enter garrison duty until a supplied recovery day resolves.</p>
    </> : target && targetState?.controller === 'player' ? <>
      <h3>Move to {target.centre}</h3>
      {targetInfo?.kind === 'route-blocked' ? <p>All strategic corridors into this province are blocked or destroyed. The formation cannot enter until a route is restored.</p> : targetInfo?.kind === 'out-of-range' ? <>
        <p>This province has no direct strategic route from {TERRITORIES[selectedGroup.location].centre}. Move the task group through controlled territory first.</p>
        <div className="forecast"><span>Available now</span><strong>{adjacentTargetNames}</strong></div>
      </> : <p>Movement occupies only this formation. Other task groups can move or attack during the same day.</p>}
      {routeOptions.length > 0 && <label>Operational corridor
        <select value={chosenRouteId} onChange={event => setSelectedRouteId(event.target.value)}>
          {routeOptions.map(route => {
            const days = estimateRouteMovementDays(route, state.routeStates[route.id], selectedGroup);
            return <option key={route.id} value={route.id}>{route.name} · {ROUTE_TYPE_LABELS[route.type]} · ~{days} day{days === 1 ? '' : 's'}</option>;
          })}
        </select>
      </label>}
      {chosenRoute && <div className="forecast"><span>Estimated travel</span><strong>{chosenRouteDays} day{chosenRouteDays === 1 ? '' : 's'}</strong></div>}
      <button className="primary" data-tutorial="move-action" disabled={!canMove} onClick={() => setState(current => issueMove(current, chosenRouteId || undefined))}>{canMove ? 'Issue movement order' : targetInfo?.kind === 'route-blocked' ? 'Corridor blocked' : 'Out of operational range'}</button>
    </> : target && targetContact ? <>
      <h3>{TERRITORIES[selectedGroup.location].centre} → {target.centre}</h3>
      {targetInfo?.kind === 'route-blocked' ? <p>Every strategic corridor into this enemy province is blocked or destroyed. No operation can be launched from the current position.</p> : targetInfo?.kind === 'out-of-range' ? <>
        <p>This enemy province has no direct strategic route from the selected task group. Select a province marked ATTACK or move closer through controlled territory.</p>
        <div className="forecast"><span>Available now</span><strong>{adjacentTargetNames}</strong></div>
      </> : targetOperation ? <>
        <p>An operation is already underway. Joining commits {selectedGroup.name} as an additional attacking formation.</p>
        <div className="forecast"><span>Current participants</span><strong>{targetOperation.participantGroupIds.length}</strong></div>
        <div className="forecast"><span>Current progress</span><strong>{targetOperation.progress}%</strong></div>
      </> : <p>{target.terrain === 'mountainous' ? 'Severe terrain and entrenched defenders favour the enemy.' : 'A persistent enemy command is defending this territory. Losses will carry into later battles.'}</p>}
      <div className="forecast"><span>Recon confidence</span><strong>{targetContact.confidence}</strong></div>
      <div className="forecast"><span>Assessed personnel</span><strong>{formatNumber(targetContact.estimatedMin)}–{formatNumber(targetContact.estimatedMax)}</strong></div>
      <div className="forecast"><span>Formation identity</span><strong>{targetContact.formationCount ? `${targetContact.formationCount} confirmed` : 'Unconfirmed'}</strong></div>
      {routeOptions.length > 0 && <label>Operational corridor
        <select value={chosenRouteId} onChange={event => setSelectedRouteId(event.target.value)}>
          {routeOptions.map(route => <option key={route.id} value={route.id}>{route.name} · {ROUTE_TYPE_LABELS[route.type]}</option>)}
        </select>
      </label>}
      <button className="primary danger-action" data-tutorial="attack-action" disabled={!canAttack} onClick={() => setState(current => beginOperation(current, chosenRouteId || undefined))}>{canAttack ? (targetOperation ? 'Join operation' : 'Begin operation') : targetInfo?.kind === 'route-blocked' ? 'Corridor blocked' : 'Out of operational range'}</button>
    </> : <>
      <p>Select one of the provinces marked ATTACK or MOVE on the map. Available from {TERRITORIES[selectedGroup.location].centre}: {adjacentTargetNames}.</p>
      <button className="secondary" data-tutorial="garrison-action" disabled={!canOrderSelected || state.status !== 'playing'} onClick={() => setState(setGarrison)}>{selectedGroup.status === 'garrison' ? 'Release from garrison' : 'Assign as garrison'}</button>
    </>}
  </section>;

  return <main aria-busy={Boolean(movementResolution)} className={`app-shell command-app-shell ${movementResolution ? 'movement-resolution-active ' : ''}${tutorialStep ? `tutorial-step-${tutorialStep.target}` : ''}`}>

    <header className="topbar command-topbar">
      <div><p className="eyebrow">PHASE VIII-D / OPERATIONAL CLARITY AND ONBOARDING · PLAYTEST 1 / WP4 DEFENCE AND THREAT CLARITY · WP5 COMBAT REPORTING · WP6 LOGISTICS UI · WP7 INFRASTRUCTURE CLARITY · WP8 GUIDED HELP</p><h1>FUTURE CONQUEST</h1></div>
      <div className="topbar-command-actions">
        <button className="global-resolve" data-tutorial="resolve-day" onClick={resolveDay} disabled={state.status !== 'playing' || collapseDecisionPending || Boolean(movementResolution)}>Resolve all orders · day {state.turn}</button>
        <div className="turn-block"><span>DAY</span><strong>{String(state.turn).padStart(3, '0')}</strong><em>{state.difficulty}</em></div>
      </div>
    </header>

    <section className="metrics command-metrics">
      <div><span>Active personnel</span><strong>{formatNumber(totalPersonnel)}</strong></div>
      <div><span>Functional armour</span><strong>{armourPercent}%</strong></div>
      <button type="button" className={`network-supply-metric ${supplyClarity.severity}`} title={`${state.logistics.totalDelivered} of ${state.logistics.totalDemand} supply points delivered. Open logistics diagnostics.`} onClick={() => changeView('logistics')}><span>Network supply · {supplyClarity.trend}</span><strong>{state.logistics.networkEfficiency}%</strong></button>
      <div><span>Active operations</span><strong>{operations.length}</strong></div>
      <div><span>Territories</span><strong>{controlled} / {territoryDefinitions.length}</strong></div>
      <div className="escalation"><span>Global escalation · Stage {escalationStage.id} · {escalationLabel}</span><div className="meter"><i style={{ width: `${state.escalation}%` }} /></div><strong>{Math.round(state.escalation)}</strong></div>
    </section>

    {supplyClarity.severity !== 'normal' && <section className={`operational-alert-strip ${supplyClarity.severity}`} aria-live="polite">
      <div><small>LOGISTICS {supplyClarity.severity.toUpperCase()}</small><strong>{state.logistics.networkEfficiency}% network efficiency</strong></div>
      <div className="supply-diagnostic-copy"><strong>{supplyClarity.diagnostics[0]?.title ?? 'Supply network is degraded'}</strong><span>{supplyClarity.diagnostics[0]?.detail}</span></div>
      <button type="button" onClick={() => changeView('logistics')}>Open diagnostics</button>
    </section>}

    {adviserWarnings.length > 0 && <section className={`adviser-alert-strip ${adviserWarnings[0].severity}`} aria-live="polite" data-assistance-level={assistanceLevel}>
      <div><small>ADVISER · {assistanceLevel.toUpperCase()}</small><strong>{adviserWarnings.length} strategic risk{adviserWarnings.length === 1 ? '' : 's'}</strong></div>
      <div className="adviser-warning-list" role="list">{adviserWarnings.map(warning => <div className={`adviser-warning-item ${warning.severity}`} role="listitem" key={warning.id}><strong>{warning.title}</strong><span>{warning.detail}</span><button type="button" onClick={() => openContext(warning.operationId
        ? { kind: 'operation', id: warning.operationId, reason: `${warning.title}: ${warning.detail}` }
        : warning.routeId ? { kind: 'route', id: warning.routeId, reason: `${warning.title}: ${warning.detail}` }
        : warning.groupId ? { kind: 'formation', id: warning.groupId, reason: `${warning.title}: ${warning.detail}` }
          : warning.territoryId ? { kind: 'territory', id: warning.territoryId, section: warning.category === 'undefended-threat' || warning.category === 'low-garrison' ? 'defence' : 'logistics', reason: `${warning.title}: ${warning.detail}` }
            : { kind: 'logistics', reason: `${warning.title}: ${warning.detail}` })}>Review exact target</button></div>)}</div>
      <small>Advisory only — legal orders remain available.</small>
    </section>}

    {threatenedTerritories.length > 0 && (() => {
      const threat = threatenedTerritories[0];
      const timing = threat.stage === 'recent-combat'
        ? 'after action'
        : threat.stage === 'under-attack'
          ? 'engaged now'
          : `estimated Day ${threat.executeTurn}`;
      return <section className={`enemy-action-alert ${threat.stage}`} aria-live="assertive" aria-label="ENEMY ACTION DETECTED">
        <span className="enemy-action-symbol" aria-hidden="true">⚠</span>
        <div className="enemy-action-copy">
          <strong>{threat.stage === 'recent-combat' ? 'COUNTERATTACK RESOLVED' : 'COUNTERATTACK DETECTED'}</strong>
          <span>{TERRITORIES[threat.territoryId].centre} · {threat.formationCount} formation{threat.formationCount === 1 ? '' : 's'} · {timing}</span>
          {threatenedTerritories.length > 1 && <small>+{threatenedTerritories.length - 1} additional threatened position{threatenedTerritories.length === 2 ? '' : 's'}</small>}
        </div>
        <button type="button" onClick={() => openContext({ kind: 'territory', id: threat.territoryId, section: 'defence', reason: `${threat.summary} · ${timing}.` })}>Review Defence</button>
      </section>;
    })()}

    {latestCombatReport?.turn === state.turn && <CombatAfterActionAlert report={latestCombatReport} onReview={() => changeView('operations')} />}

    {state.status !== 'playing' && <div className={`command-outcome ${state.status}`}><strong>{state.status === 'victory' ? 'REGIONAL VICTORY' : 'CAMPAIGN DEFEAT'}</strong><span>Review the campaign log or begin a new campaign.</span></div>}

    <section className="command-workspace">
      <CommandNavigation
        active={currentView}
        onChange={changeView}
        badges={{ forces: groups.length, operations: operations.length, territories: `${controlled}/${territoryDefinitions.length}`, engineering: state.engineeringProjects.filter(project => project.status === 'active').length + state.interdictionMissions.filter(mission => mission.status === 'active').length, logistics: state.logistics.starvedFormationIds.length + state.logistics.starvedTerritoryIds.length, intelligence: frontlineTerritories.length }}
      />

      <div className={`command-stage command-stage-${currentView}`}>
        {navigationContext && currentView !== 'engineering' && <aside className={`contextual-navigation-banner ${navigationContext.valid ? '' : 'fallback'}`} role="status" data-context-target={navigationContext.target.kind}>
          <strong>{navigationContext.valid ? 'Contextual target opened' : 'Target unavailable'}</strong><span>{navigationContext.message}</span>
          {navigationContext.target.kind === 'territory' && navigationContext.target.section === 'defence' && <b>Defence assessment and actions are shown in the selected territory panel.</b>}
        </aside>}
        {currentView === 'map' && <section className="workspace command-map-workspace">
          <div className="map-panel" data-tutorial="command-map">
            <div className="map-heading">
              <p>{instruction}</p>
              <div className="legend"><span className="player-dot" />Controlled <span className="enemy-dot" />Enemy <span className="group-dot" />Task group <span className="formation-dot" />Recon contact · Orange/red borders indicate threatened territory</div>
            </div>
            {terrainPrototypeRequested && terrainPrototypeFailed && <div className="r3-terrain-fallback-notice" role="alert">
              <span><strong>3D terrain unavailable</strong>{terrainPrototypeFailureReason || 'The terrain renderer returned to the stable 2D map.'}</span>
              <button type="button" onClick={() => { setTerrainPrototypeFailureReason(''); setTerrainPrototypeFailed(false); }}>Retry terrain</button>
            </div>}
            {terrainPrototypeRequested && !terrainPrototypeFailed ? <Suspense fallback={<div className="r3-terrain-prototype-loading" role="status">Loading terrain command map…</div>}>
              <TerrainMapPrototype
                state={renderedMapState}
                onSelect={openTerritoryOnMap}
                onSelectGroup={openGroupOnMap}
                onFallback={(reason) => {
                  console.warn(`R3 terrain renderer fallback: ${reason}`);
                  setTerrainPrototypeFailureReason(reason);
                  setTerrainPrototypeFailed(true);
                }}
              />
            </Suspense> : <MapView
              state={renderedMapState}
              onSelect={openTerritoryOnMap}
              onSelectGroup={openGroupOnMap}
              operationConfirmation={canAttack && target ? {
                territoryId: target.id,
                label: targetOperation ? 'Join operation?' : 'Confirm operation?',
                onConfirm: () => setState(current => beginOperation(current, chosenRouteId || undefined))
              } : undefined}
            />}
          </div>

          <aside className="command-panel map-context-panel">
            <section className="quick-command">
              <div className="quick-command-heading"><p className="panel-label">COMMAND MAP</p><span>{availableGroups.length} ready</span></div>
              <label>Active formation
                <select value={selectedGroup?.id ?? ''} onChange={event => openGroupOnMap(event.target.value)}>
                  {groups.map(group => <option key={group.id} value={group.id}>{group.name} · {TERRITORIES[group.location].centre}</option>)}
                </select>
              </label>
              {renderPriorityOrderAction()}
              <div className="quick-links"><button onClick={() => changeView('forces')}>Manage forces</button><button onClick={() => changeView('operations')}>Review operations</button></div>
            </section>
            {renderSelectedGroupPanel()}
            {renderTerritoryPanel()}
            {renderOrdersPanel()}
          </aside>
        </section>}

        {currentView === 'forces' && <section className="command-view forces-view">
          <header className="command-view-header"><div><p className="panel-label">FORCES</p><h2>Formation command</h2></div><p>Search, inspect and reorganise every expeditionary formation without obscuring the campaign map.</p></header>
          <div className="forces-command-grid">
            <FormationRoster state={state} selectedGroup={selectedGroup} onSelect={id => { setNavigationContext(null); setState(current => selectTaskGroup(current, id)); }} />
            <div className="command-view-stack">
              {renderSelectedGroupPanel()}
              <ForceOrganisationPanel state={state} selectedGroup={selectedGroup} onChange={setState} />
              {selectedGroup && <section className="view-panel view-action-panel"><p className="panel-label">MAP LOCATION</p><h3>{TERRITORIES[selectedGroup.location].name}</h3><p>Centre the command map on this formation and issue operational orders.</p><button className="primary" onClick={() => openGroupOnMap(selectedGroup.id)}>Open on command map</button></section>}
            </div>
          </div>
        </section>}

        {currentView === 'operations' && <section className="command-view operations-view">
          <header className="command-view-header"><div><p className="panel-label">OPERATIONS</p><h2>Operational command</h2></div><p>Track concurrent offensives, committed formations and the forces still available for new orders.</p></header>
          <div className="operations-command-grid">
            <section className="view-panel operations-board">
              <div className="view-panel-heading"><p className="panel-label">ACTIVE OPERATIONS</p><strong>{operations.length}</strong></div>
              {operations.length ? <div className="operation-command-list">{operations.map(operation => {
                const participantNames = operation.participantGroupIds.map(id => state.taskGroups[id]?.name).filter(Boolean).join(', ');
                const contact = enemyContacts.find(item => item.territoryId === operation.target);
                return <article key={operation.id} className="operation-command-card" data-context-selected={navigationContext?.target.kind === 'operation' && navigationContext.target.id === operation.id ? 'true' : undefined}>
                  <div className="operation-card-heading"><div><small>DAY {operation.days}</small><h3>{operationTitle(operation)}</h3></div><strong>{operation.progress}%</strong></div>
                  <div className="operation-progress"><i style={{ width: `${Math.max(0, Math.min(100, operation.progress))}%` }} /></div>
                  <dl>
                    <div><dt>Participants</dt><dd>{operation.participantGroupIds.length}</dd></div>
                    <div><dt>Recon confidence</dt><dd>{contact?.confidence ?? 'contact lost'}</dd></div>
                    <div><dt>Assessed personnel</dt><dd>{contact ? `${formatNumber(contact.estimatedMin)}–${formatNumber(contact.estimatedMax)}` : 'Unknown'}</dd></div>
                  </dl>
                  <p>{participantNames || 'No active formations'}</p>
                  <button onClick={() => openTerritoryOnMap(operation.target)}>Open operation on map</button>
                </article>;
              })}</div> : <div className="view-empty"><h3>No active operations</h3><p>Select an adjacent enemy territory on the Command Map to begin an offensive.</p><button className="primary" onClick={() => changeView('map')}>Open command map</button></div>}
            </section>

            <section className="view-panel available-forces-panel">
              <div className="view-panel-heading"><p className="panel-label">AVAILABLE FORMATIONS</p><strong>{availableGroups.length}</strong></div>
              <div className="compact-formation-list">{groups.map(group => <button key={group.id} onClick={() => openGroupOnMap(group.id)} className={canIssueOperationalOrder(group) ? '' : 'unavailable'}>
                <span><strong>{group.name}</strong><small>{TERRITORIES[group.location].centre} · {group.status}</small></span>
                <b>{formatNumber(group.personnel)}</b>
              </button>)}</div>
            </section>

            <CombatReportsPanel state={state} onOpenTerritory={openTerritoryOnMap} />

            <section className="view-panel operational-reports">
              <div className="view-panel-heading"><p className="panel-label">RECENT REPORTS</p><strong>{state.events.length}</strong></div>
              <div className="vertical-event-list">{state.events.slice(0, 10).map(event => <article key={event.id} className={event.tone}><time>DAY {String(event.turn).padStart(3, '0')}</time><p>{event.text}</p></article>)}</div>
            </section>
          </div>
        </section>}

        {currentView === 'territories' && <section className="command-view territories-view">
          <header className="command-view-header"><div><p className="panel-label">TERRITORIES</p><h2>Territorial administration</h2></div><p>Review control, occupation, supply and garrison demand across the current operational theatre.</p></header>
          <div className="territory-summary-strip">
            <div><span>Controlled</span><strong>{controlled}</strong></div>
            <div><span>Unsecured</span><strong>{unsecured}</strong></div>
            <div><span>Isolated</span><strong>{isolated}</strong></div>
            <div><span>Enemy-held</span><strong>{territoryDefinitions.length - controlled}</strong></div>
          </div>
          <div className="territory-command-grid">{territoryDefinitions.map(territory => {
            const territoryState = state.territories[territory.id];
            const contact = territoryState.controller === 'enemy' ? enemyContacts.find(item => item.territoryId === territory.id) : undefined;
            return <article key={territory.id} className={`territory-command-card ${territoryState.controller} ${territoryState.supplied ? 'supplied' : 'isolated'}`}>
              <div className="territory-command-heading"><div><small>{territory.id}</small><h3>{territory.name}</h3><span>{territory.centre}</span></div><b>{territoryState.occupation}</b></div>
              <dl>
                <div><dt>Terrain</dt><dd>{TERRAIN_LABELS[territory.terrain]}</dd></div>
                <div><dt>Supply value</dt><dd>{territory.supply}</dd></div>
                <div><dt>Supply route</dt><dd>{territoryState.supplied ? 'Connected' : 'Isolated'}</dd></div>
                <div><dt>Throughput</dt><dd>{state.logistics.territoryAllocations[territory.id] ? `${state.logistics.territoryAllocations[territory.id].delivered}/${state.logistics.territoryAllocations[territory.id].demand}` : '0/0'}</dd></div>
                <div><dt>Fortification</dt><dd>{Math.round(territoryState.fortification)}</dd></div>
                {territoryState.controller === 'player' ? <>
                  <div><dt>Occupation need</dt><dd>{formatNumber(occupationRequirement(territory.id))}</dd></div>
                  <div><dt>Resistance</dt><dd>{Math.round(territoryState.resistance)}</dd></div>
                </> : <>
                  <div><dt>Enemy contact</dt><dd>{contact?.confidence ?? 'No current contact'}</dd></div>
                  <div><dt>Assessed personnel</dt><dd>{contact ? `${formatNumber(contact.estimatedMin)}–${formatNumber(contact.estimatedMax)}` : 'Unknown'}</dd></div>
                </>}
              </dl>
              <button onClick={() => openTerritoryOnMap(territory.id)}>Select on map</button>
            </article>;
          })}</div>
        </section>}

        {currentView === 'engineering' && <InfrastructureCommand
          state={state}
          onChange={setState}
          onOpenTerritory={openTerritoryOnMap}
          onClearContext={() => setNavigationContext(null)}
          context={navigationContext}
        />}

        {/* supply-diagnostics-panel compatibility marker: diagnostics now live inside the unified LogisticsCommand surface. */}
        {/* Legacy test marker replaced by contextual targeting: onOpenInfrastructure={() => changeView('engineering')} */}
        {currentView === 'logistics' && <LogisticsCommand
          state={state}
          onChange={setState}
          onOpenGroup={openGroupOnMap}
          onOpenTerritory={openTerritoryOnMap}
          onOpenInfrastructure={(routeId, reason) => openContext(routeId ? { kind: 'route', id: routeId, reason: reason ?? 'Logistics identified this route.' } : { kind: 'infrastructure', reason: reason ?? 'Review the infrastructure network.' })}
        />}

        {currentView === 'intelligence' && <section className="command-view intelligence-view">
          <header className="command-view-header"><div><p className="panel-label">INTELLIGENCE</p><h2>Strategic picture</h2></div><p>Consolidated enemy strength, frontline pressure, escalation and supply warnings.</p></header>
          <div className="intelligence-command-grid">
            <section className="view-panel escalation-panel">
  <p className="panel-label">GLOBAL ESCALATION · STAGE {escalationStage.id}</p>
  <div className="escalation-readout"><strong>{Math.round(state.escalation)}</strong><span>{escalationLabel}</span></div>
  <div className="large-meter"><i style={{ width: `${state.escalation}%` }} /></div>
  <p className="escalation-stage-copy">{escalationStage.description}</p>
  <div className="strategic-response-summary">
    <div><span>Mobilisation reserve</span><strong>{formatNumber(state.mobilisationPool)}</strong></div>
    <div><span>Pending formations</span><strong>{pendingMobilisations.length}</strong></div>
    <div><span>Active enemy plans</span><strong>{activeEnemyOrders.length}</strong></div>
  </div>
  <div className="stage-threshold"><span>Next stage</span><strong>{escalationStage.nextThreshold === null ? 'Maximum escalation' : `${escalationStage.nextThreshold}%`}</strong></div>
</section>
            <section className={`view-panel enemy-strategy-panel ${state.enemyStrategy.doctrine}`}>
              <div className="view-panel-heading"><p className="panel-label">ENEMY THEATRE COMMAND</p><strong>{Math.round(state.enemyStrategy.pressure)}%</strong></div>
              <h3>{state.enemyStrategy.doctrine.replace('-', ' ')}</h3>
              <div className="enemy-strategy-meter"><i style={{ width: `${state.enemyStrategy.pressure}%` }} /></div>
              <dl>
                <div><dt>Operational focus</dt><dd>{state.enemyStrategy.focusTerritory ? TERRITORIES[state.enemyStrategy.focusTerritory].centre : 'No single focus'}</dd></div>
                <div><dt>Invasion momentum</dt><dd>{Math.round(state.enemyStrategy.momentum)}</dd></div>
                <div><dt>Threatened corridors</dt><dd>{state.enemyStrategy.threatenedRouteIds.length}</dd></div>
                <div><dt>Operational crisis</dt><dd>{state.enemyStrategy.operationalCrisisTurns} / {state.difficulty === 'story' ? 5 : state.difficulty === 'hard' ? 3 : 4} days</dd></div>
              </dl>
              <p>Doctrine reacts to frontline strength, logistics weakness, vulnerable supply regions and campaign momentum. Stabilising those conditions reduces pressure and crisis risk.</p>
            </section>
            <section className="view-panel enemy-summary-panel">
              <p className="panel-label">ASSESSED ENEMY STRENGTH</p>
              <div className="intelligence-kpis"><div><span>Territory contacts</span><strong>{enemyContacts.length}</strong></div><div><span>Assessed personnel</span><strong>~{formatNumber(enemyPersonnel)}</strong></div><div><span>Confirmed contacts</span><strong>{confirmedEnemyContacts}</strong></div></div>
            </section>
<section className="view-panel mobilisation-panel">
  <div className="view-panel-heading"><p className="panel-label">MOBILISATION PIPELINE</p><strong>{pendingMobilisations.length}</strong></div>
  {pendingMobilisations.length ? <div className="mobilisation-list">{pendingMobilisations.map(project => <article key={project.id} className="mobilisation-card">
    <header><strong>{project.name}</strong><b>DAY {String(project.arrivalTurn).padStart(3, '0')}</b></header>
    <p>{project.source} · expected entry at {project.entryTerritory ? TERRITORIES[project.entryTerritory].centre : 'an unconfirmed location'}.</p>
    <dl><div><dt>Personnel</dt><dd>{formatNumber(project.personnel)}</dd></div><div><dt>Armour</dt><dd>{formatNumber(project.armour)}</dd></div><div><dt>Status</dt><dd>{project.status}</dd></div></dl>
  </article>)}</div> : <p className="empty-state">No additional formations are currently preparing to enter the theatre.</p>}
</section>
<section className="view-panel enemy-plan-panel">
  <div className="view-panel-heading"><p className="panel-label">ASSESSED ENEMY INTENT</p><strong>{activeEnemyOrders.length}</strong></div>
  {activeEnemyOrders.length ? <div className="enemy-plan-list">{activeEnemyOrders.map(order => <article key={order.id} className="enemy-plan-card">
    <header><strong>{order.summary}</strong><b className="order-type">{order.type}</b></header>
    <p>{order.origin ? `${TERRITORIES[order.origin].centre} → ` : ''}{TERRITORIES[order.target].centre}{order.executeTurn ? ` · expected day ${String(order.executeTurn).padStart(3, '0')}` : ''} · {order.status}</p>
  </article>)}</div> : <p className="empty-state">No coherent enemy operational plan has been identified this day.</p>}
</section>
<section className="view-panel intelligence-report-panel">
  <div className="view-panel-heading"><p className="panel-label">INTELLIGENCE REPORTS</p><strong>{intelligenceReports.length}</strong></div>
  <div className="intelligence-report-list">{intelligenceReports.map(report => <article key={report.id} className={`intelligence-report-card ${report.confidence}`}>
    <header><strong>{report.title}</strong><b>{report.confidence} confidence</b></header>
    <p>{report.detail}</p>
    {(report.estimatedMin !== undefined || report.territoryId) && <small>{report.estimatedMin !== undefined && report.estimatedMax !== undefined ? `Estimated strength ${formatNumber(report.estimatedMin)}–${formatNumber(report.estimatedMax)}` : ''}{report.territoryId ? `${report.estimatedMin !== undefined ? ' · ' : ''}${TERRITORIES[report.territoryId].centre}` : ''}</small>}
  </article>)}</div>
</section>
            <section className="view-panel frontline-panel">
              <div className="view-panel-heading"><p className="panel-label">FRONTLINE THREATS</p><strong>{frontlineTerritories.length}</strong></div>
              {frontlineTerritories.length ? <div className="intelligence-list">{frontlineTerritories.map(territory => {

                const contact = enemyContacts.find(item => item.territoryId === territory.id);
                const friendlyPositions = territory.neighbours.filter(neighbour => state.territories[neighbour]?.controller === 'player').sort();
                const defensivePosition = friendlyPositions.length === 1 ? friendlyPositions[0] : null;

                return <button key={territory.id} onClick={() => openContext(defensivePosition
                  ? { kind: 'territory', id: defensivePosition, section: 'defence', reason: `Frontline threat at ${territory.centre}. Review the uniquely adjacent friendly defensive position at ${TERRITORIES[defensivePosition].centre}.` }
                  : { kind: 'territory', id: territory.id, section: 'intelligence', reason: `Frontline threat at ${territory.centre}. No unique friendly defensive position can be identified; review this enemy-held offensive objective and its intelligence.` }
                )}><span><strong>{territory.name}</strong><small>{territory.centre} · {TERRAIN_LABELS[territory.terrain]} · {contact?.confidence ?? 'contact uncertain'}</small></span><b>{contact ? `${formatNumber(contact.estimatedMin)}–${formatNumber(contact.estimatedMax)}` : 'UNKNOWN'}</b></button>;

              })}</div> : <p className="empty-state">No enemy-held province currently borders controlled territory.</p>}
            </section>
            <section className="view-panel enemy-order-panel">
              <div className="view-panel-heading"><p className="panel-label">RECONNAISSANCE CONTACTS</p><strong>{enemyContacts.length}</strong></div>
              <div className="enemy-formation-table enemy-contact-table">{enemyContacts.map(contact => <article key={contact.territoryId} className={contact.confidence}>
                <div><strong>{contact.label}</strong><span>{TERRITORIES[contact.territoryId].centre}{contact.lastObservedTurn ? ` · observed day ${contact.lastObservedTurn}` : ''}</span></div>
                <dl><div><dt>Confidence</dt><dd>{contact.confidence}</dd></div><div><dt>Estimated personnel</dt><dd>{formatNumber(contact.estimatedMin)}–{formatNumber(contact.estimatedMax)}</dd></div><div><dt>Identity</dt><dd>{contact.formationCount ? `${contact.formationCount} confirmed` : 'Unconfirmed'}</dd></div></dl>
                <button type="button" onClick={() => openThreatOnMap(contact.territoryId)}>Open on map</button>
              </article>)}</div>
            </section>
            <section className="view-panel logistics-network-panel">
              <div className="view-panel-heading"><p className="panel-label">LOGISTICS NETWORK</p><strong>{state.logistics.networkEfficiency}%</strong></div>
              <div className="logistics-summary-grid">
                <div><span>Source capacity</span><strong>{state.logistics.sourceUsed}/{state.logistics.sourceCapacity}</strong></div>
                <div><span>Total demand</span><strong>{state.logistics.totalDemand}</strong></div>
                <div><span>Delivered</span><strong>{state.logistics.totalDelivered}</strong></div>
                <div><span>Bottlenecks</span><strong>{bottleneckRoutes.length}</strong></div>
              </div>
              {bottleneckRoutes.length ? <div className="logistics-list">{bottleneckRoutes.map(route => {
                const flow = state.logistics.routeFlows[route.id];
                return <button key={route.id} onClick={() => openContext({ kind: 'route', id: route.id, reason: `Intelligence reports ${Math.round(flow.utilisation)}% utilisation and ${flow.condition} condition.` })}><span><strong>{route.name}</strong><small>{flow.used}/{flow.capacity} throughput · {flow.condition}</small></span><b>{Math.round(flow.utilisation)}%</b></button>;
              })}</div> : <p className="empty-state">The controlled network currently has no saturated strategic corridor.</p>}
            </section>
            <section className="view-panel warning-panel">
              <div className="view-panel-heading"><p className="panel-label">SUPPLY WARNINGS</p><strong>{supplyDisruptions.length + stressedFormations.length}</strong></div>
              {(supplyDisruptions.length || stressedFormations.length) ? <div className="intelligence-list">
                {stressedFormations.map(group => { const allocation = state.logistics.formationAllocations[group.id]; return <button key={group.id} onClick={() => openContext({ kind: 'formation', id: group.id, reason: `${group.name} has ${allocation?.ratio ?? 0}% logistics delivery.` })}><span><strong>{group.name}</strong><small>{TERRITORIES[group.location].centre} · {allocation ? SUPPLY_CONDITION_LABELS[allocation.condition] : 'Cut off'}</small></span><b>{allocation?.ratio ?? 0}%</b></button>; })}
                {supplyDisruptions.map(territory => <button key={territory.id} onClick={() => openContext({ kind: 'territory', id: territory.id, section: 'logistics', reason: `${territory.centre} is controlled but isolated.` })}><span><strong>{territory.name}</strong><small>Controlled but isolated</small></span><b>RECONNECT</b></button>)}
              </div> : <p className="empty-state">All formations and controlled territories are receiving adequate throughput.</p>}
            </section>
            <section className="view-panel alert-panel">
              <div className="view-panel-heading"><p className="panel-label">RECENT ALERTS</p><strong>{recentAlerts.length}</strong></div>
              <div className="vertical-event-list">{recentAlerts.length ? recentAlerts.map(event => <article key={event.id} className={event.tone}><time>DAY {String(event.turn).padStart(3, '0')}</time><p>{event.text}</p></article>) : <p className="empty-state">No recent warning or danger reports.</p>}</div>
            </section>
          </div>
        </section>}

        {currentView === 'campaign' && <section className="command-view campaign-view">
          <header className="command-view-header"><div><p className="panel-label">CAMPAIGN</p><h2>Campaign control</h2></div><p>Save, restore or restart the campaign and review the complete command log.</p></header>
          <div className="campaign-command-grid">
            <section className="view-panel campaign-controls-panel">
              <p className="panel-label">CAMPAIGN SAVE DATA</p>
              <div className="campaign-status-card"><span>Current campaign</span><strong>Day {String(state.turn).padStart(3, '0')}</strong><small>Seed {state.seed} · {state.difficulty} · {controlled}/{territoryDefinitions.length} territories</small></div>
              <div className="campaign-file-actions"><button onClick={() => saveGame(state)}>Manual Save</button><button onClick={load}>Load Manual Save</button><button onClick={loadAutosave}>Load Autosave</button></div>
              <p className="settings-future-copy">Manual Save and Autosave are separate campaign slots. Autosave never overwrites your Manual Save.</p>
              <div className="new-campaign-controls"><label>New campaign difficulty<select value={newDifficulty} onChange={event => setNewDifficulty(event.target.value as Difficulty)}><option value="story">Story</option><option value="standard">Standard</option><option value="hard">Hard</option></select></label><label className="tutorial-toggle"><input type="checkbox" checked={newTutorialEnabled} onChange={event => setNewTutorialEnabled(event.target.checked)} /> Guided tutorial</label><button className="danger-action" onClick={startCampaign}>New campaign</button></div><div className="campaign-file-actions"><button onClick={() => setState(restartTutorial)}>Restart tutorial</button><button onClick={() => setState(skipTutorial)} disabled={!state.tutorial.enabled}>Skip tutorial</button></div>
            </section>
            <section className="view-panel campaign-overview-panel">
              <p className="panel-label">CAMPAIGN SUMMARY</p>
              <dl>
                <div><dt>Status</dt><dd>{collapseDecisionPending ? 'strategic collapse decision' : state.status}</dd></div><div><dt>Enemy doctrine</dt><dd>{state.enemyStrategy.doctrine}</dd></div><div><dt>Operational crisis</dt><dd>{state.enemyStrategy.operationalCrisisTurns}</dd></div><div><dt>Escalation stage</dt><dd>{escalationStage.id} · {escalationLabel}</dd></div><div><dt>Mobilisation reserve</dt><dd>{formatNumber(state.mobilisationPool)}</dd></div>
                <div><dt>Wounded pool</dt><dd>{formatNumber(state.woundedPool)}</dd></div>
                <div><dt>After-action reports</dt><dd>{combatReports.length}</dd></div>
                <div><dt>Active personnel</dt><dd>{formatNumber(totalPersonnel)}</dd></div>
                <div><dt>Assessed enemy personnel</dt><dd>~{formatNumber(enemyPersonnel)}</dd></div>
                <div><dt>Unsecured territories</dt><dd>{unsecured}</dd></div>
                <div><dt>Supply disruptions</dt><dd>{isolated}</dd></div>
                <div><dt>Network throughput</dt><dd>{state.logistics.totalDelivered} / {state.logistics.totalDemand}</dd></div>
                <div><dt>Route bottlenecks</dt><dd>{bottleneckRoutes.length}</dd></div>
                <div><dt>Engineering projects</dt><dd>{state.engineeringProjects.filter(project => project.status === 'active').length}</dd></div>
                <div><dt>Interdiction missions</dt><dd>{state.interdictionMissions.filter(mission => mission.status === 'active').length}</dd></div>
              </dl>
            </section>
            <section className="view-panel command-reference-panel">
              <p className="panel-label">COMMAND REFERENCE</p>
              <dl><div><dt>Map pan</dt><dd>Drag / arrow keys</dd></div><div><dt>Map zoom</dt><dd>Wheel / pinch / + −</dd></div><div><dt>Europe view</dt><dd>T or 0</dd></div><div><dt>Campaign view</dt><dd>C</dd></div><div><dt>Selected territory</dt><dd>F</dd></div></dl>
            </section>
          </div>
          <section className="event-log campaign-event-log">
            <div className="log-heading"><p className="panel-label">COMMAND LOG</p><span>{state.events.length} reports · {state.woundedPool} wounded</span></div>
            <div className="events campaign-events">{state.events.map(event => <article key={event.id} className={event.tone}><time>DAY {String(event.turn).padStart(3, '0')}</time><p>{event.text}</p></article>)}</div>
          </section>
        </section>}
      </div>
    </section>

    {movementResolution && <div
      className="r3-movement-resolution-lock"
      role="status"
      aria-live="polite"
      data-phase={movementResolution.phase}
      data-from-turn={state.turn}
      data-to-turn={movementResolution.next.turn}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'auto', background: 'transparent' }}
    >
      <div style={{ position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', width: 'min(540px, calc(100vw - 32px))', padding: '14px 18px', border: '1px solid rgba(143,255,241,0.7)', borderRadius: 10, background: 'rgba(8,18,21,0.94)', boxShadow: '0 14px 36px rgba(0,0,0,0.42)', textAlign: 'center' }}>
        <small style={{ display: 'block', letterSpacing: '0.14em', opacity: 0.78 }}>END-OF-DAY OPERATIONAL MOVEMENT</small>
        <strong style={{ display: 'block', marginTop: 4, fontSize: '1.05rem' }}>{movementResolution.phase === 'arming' ? 'Orders locked' : 'Movement resolution'}</strong>
        <span style={{ display: 'block', marginTop: 3, opacity: 0.82 }}>Day {String(state.turn).padStart(3, '0')} → {String(movementResolution.next.turn).padStart(3, '0')} · ordered formations resolving concurrently</span>
      </div>
    </div>}

    <TutorialOverlay step={tutorialStep} stepNumber={state.tutorial.step + 1} totalSteps={TUTORIAL_STEPS.length} anchorSelector={tutorialAnchorSelector} onSkip={() => setState(skipTutorial)} onBack={() => setState(current => moveTutorial(current, -1))} onForward={() => setState(current => moveTutorial(current, 1))} />

    {collapseDecisionPending && <StrategicCollapseDecision
      state={state}
      onContinue={() => setState(continueCampaignAfterCollapse)}
      onSurrender={() => setState(surrenderCampaign)}
    />}

    {showSupplyWarning && <div className="supply-warning-backdrop" role="presentation">
      <section className="supply-warning-dialog" role="dialog" aria-modal="true" aria-label="Critical supply warning">
        <p className="panel-label">END TURN WARNING</p>
        <h2>Correctable logistics failures remain</h2>
        <p>Resolving the day may cause avoidable attrition, retreat pressure or operational crisis. Review the network or explicitly accept the risk.</p>
        <ul>{supplyClarity.diagnostics.slice(0, 5).map(item => <li key={item.id}><strong>{item.title}:</strong> {item.detail}</li>)}</ul>
        <div className="supply-warning-actions"><button type="button" onClick={() => setShowSupplyWarning(false)}>Return to command</button><button type="button" onClick={() => { setShowSupplyWarning(false); changeView('logistics'); }}>Open logistics</button><button type="button" className="danger-action" onClick={resolveDayAnyway}>Resolve anyway</button></div>
      </section>
    </div>}
  </main>;
}
