import { CENTRAL_FRONT_CAMPAIGN_OBJECTIVES } from '../game/board-campaign';
import type { BoardPresentationController, BoardRenderProjection } from '../game/board-state-render-projection';

export interface Bg12iBoardTokenEvidence {
  formationMarkers: number;
  controlMarkers: number;
  objectiveMarkers: number;
  projectedFormationIds: string[];
  projectedSpaceIds: string[];
  projectedObjectiveSpaceIds: string[];
}

const SUPPLY_LABELS = {
  supplied: 'Supplied',
  strained: 'Strained supply',
  isolated: 'Isolated'
} as const;

const CONTROL_GLYPHS: Record<BoardPresentationController, string> = {
  player: '●',
  enemy: '◆',
  neutral: '□'
};

const CONTROL_LABELS: Record<BoardPresentationController, string> = {
  player: 'Expedition control',
  enemy: 'Defender control',
  neutral: 'Neutral control'
};

const OBJECTIVE_BY_SPACE = new Map(
  CENTRAL_FRONT_CAMPAIGN_OBJECTIVES.map(objective => [objective.spaceId, objective] as const)
);

function baseAccessibleLabel(element: HTMLElement): string {
  const saved = element.dataset.bg12iBaseLabel;
  if (saved !== undefined) return saved;
  const current = element.getAttribute('aria-label')?.trim() ?? '';
  element.dataset.bg12iBaseLabel = current;
  return current;
}

function formationStateHost(marker: HTMLElement): HTMLSpanElement {
  const existing = marker.querySelector<HTMLSpanElement>(':scope > .bg12i-formation-state');
  if (existing) return existing;
  const state = document.createElement('span');
  state.className = 'bg12i-formation-state';
  state.setAttribute('aria-hidden', 'true');
  marker.append(state);
  return state;
}

function stateChip(kind: 'readiness' | 'damage' | 'supply', text: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = `bg12i-state-chip bg12i-state-${kind}`;
  chip.dataset.kind = kind;
  chip.textContent = text;
  return chip;
}

function controlTokenHost(marker: HTMLElement): HTMLElement {
  const existing = marker.querySelector<HTMLElement>(':scope > .bg12i-control-token');
  if (existing) return existing;
  const token = document.createElement('i');
  token.className = 'bg12i-control-token';
  token.setAttribute('aria-hidden', 'true');
  marker.append(token);
  return token;
}

function objectiveTokenHost(marker: HTMLElement): HTMLElement {
  const existing = marker.querySelector<HTMLElement>(':scope > .bg12i-objective-token');
  if (existing) return existing;
  const token = document.createElement('i');
  token.className = 'bg12i-objective-token';
  token.setAttribute('aria-hidden', 'true');
  marker.append(token);
  return token;
}

/**
 * BG12I presentation seam. Annotates the existing MapLibre DOM marker layer with
 * already-authoritative board projection values and the existing BG10 objective
 * registry. It never moves markers, mutates board state, creates map objects or
 * invents a second token data model.
 */
export function applyBg12iBoardTokens(
  root: ParentNode,
  projection: BoardRenderProjection
): Bg12iBoardTokenEvidence {
  const pieceById = new Map(projection.pieces.map(piece => [piece.id, piece]));
  const projectedFormationIds: string[] = [];
  const projectedSpaceIds: string[] = [];
  const projectedObjectiveSpaceIds: string[] = [];

  const formationMarkers = [...root.querySelectorAll<HTMLElement>('.r3-terrain-task-group-marker[data-group-id]')];
  for (const marker of formationMarkers) {
    const groupId = marker.dataset.groupId;
    const piece = groupId ? pieceById.get(groupId) : undefined;
    const state = marker.querySelector<HTMLElement>(':scope > .bg12i-formation-state');

    if (!groupId || !piece || piece.controller !== 'player') {
      delete marker.dataset.bg12iReadiness;
      delete marker.dataset.bg12iDamage;
      delete marker.dataset.bg12iSupply;
      state?.remove();
      continue;
    }

    marker.dataset.bg12iReadiness = String(piece.readiness);
    marker.dataset.bg12iDamage = String(piece.damage);
    marker.dataset.bg12iSupply = piece.supply;
    marker.classList.toggle('bg12i-formation-strained', piece.supply === 'strained');
    marker.classList.toggle('bg12i-formation-isolated', piece.supply === 'isolated');
    marker.classList.toggle('bg12i-formation-damaged', piece.damage > 0);

    const host = formationStateHost(marker);
    host.replaceChildren(stateChip('readiness', `R${piece.readiness}`));
    if (piece.damage > 0) host.append(stateChip('damage', `D${piece.damage}`));
    if (piece.supply !== 'supplied') {
      host.append(stateChip('supply', piece.supply === 'isolated' ? 'ISO' : 'SUP!'));
    }

    const stateLabel = `Readiness ${piece.readiness} of 100, damage ${piece.damage} of 3, ${SUPPLY_LABELS[piece.supply]}`;
    const baseLabel = baseAccessibleLabel(marker);
    marker.setAttribute('aria-label', baseLabel ? `${baseLabel}. ${stateLabel}.` : stateLabel);
    marker.title = stateLabel;
    projectedFormationIds.push(groupId);
  }

  const territoryMarkers = [...root.querySelectorAll<HTMLElement>('.r3-terrain-territory-label[data-territory-id]')];
  for (const marker of territoryMarkers) {
    const territoryId = marker.dataset.territoryId;
    if (!territoryId) {
      marker.querySelector(':scope > .bg12i-control-token')?.remove();
      marker.querySelector(':scope > .bg12i-objective-token')?.remove();
      delete marker.dataset.bg12iController;
      delete marker.dataset.bg12iObjective;
      continue;
    }

    const controller = projection.spaceControllers[territoryId];
    const objective = OBJECTIVE_BY_SPACE.get(territoryId);
    const labels: string[] = [];

    if (controller) {
      marker.dataset.bg12iController = controller;
      const token = controlTokenHost(marker);
      token.textContent = CONTROL_GLYPHS[controller];
      token.dataset.controller = controller;
      token.title = CONTROL_LABELS[controller];
      labels.push(CONTROL_LABELS[controller]);
      projectedSpaceIds.push(territoryId);
    } else {
      marker.querySelector(':scope > .bg12i-control-token')?.remove();
      delete marker.dataset.bg12iController;
    }

    if (objective) {
      marker.dataset.bg12iObjective = objective.label;
      const token = objectiveTokenHost(marker);
      token.textContent = '★';
      token.dataset.objective = objective.label;
      token.title = `Strategic objective: ${objective.label}`;
      labels.push(`Strategic objective: ${objective.label}`);
      projectedObjectiveSpaceIds.push(territoryId);
    } else {
      marker.querySelector(':scope > .bg12i-objective-token')?.remove();
      delete marker.dataset.bg12iObjective;
    }

    const baseLabel = baseAccessibleLabel(marker);
    const projectedLabel = labels.join('. ');
    if (baseLabel && projectedLabel) marker.setAttribute('aria-label', `${baseLabel}. ${projectedLabel}.`);
    else if (projectedLabel) marker.setAttribute('aria-label', projectedLabel);
    else if (baseLabel) marker.setAttribute('aria-label', baseLabel);
  }

  return {
    formationMarkers: projectedFormationIds.length,
    controlMarkers: projectedSpaceIds.length,
    objectiveMarkers: projectedObjectiveSpaceIds.length,
    projectedFormationIds,
    projectedSpaceIds,
    projectedObjectiveSpaceIds
  };
}
