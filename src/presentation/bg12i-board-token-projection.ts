import type { BoardPresentationController, BoardRenderProjection } from '../game/board-state-render-projection';

export interface Bg12iBoardTokenEvidence {
  formationMarkers: number;
  controlMarkers: number;
  projectedFormationIds: string[];
  projectedSpaceIds: string[];
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

/**
 * BG12I presentation seam. Annotates the existing MapLibre DOM marker layer with
 * already-authoritative board projection values. It never moves markers, mutates
 * board state, creates map objects or invents a second token data model.
 */
export function applyBg12iBoardTokens(
  root: ParentNode,
  projection: BoardRenderProjection
): Bg12iBoardTokenEvidence {
  const pieceById = new Map(projection.pieces.map(piece => [piece.id, piece]));
  const projectedFormationIds: string[] = [];
  const projectedSpaceIds: string[] = [];

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
    const controller = territoryId ? projection.spaceControllers[territoryId] : undefined;
    if (!territoryId || !controller) {
      marker.querySelector(':scope > .bg12i-control-token')?.remove();
      delete marker.dataset.bg12iController;
      continue;
    }

    marker.dataset.bg12iController = controller;
    const token = controlTokenHost(marker);
    token.textContent = CONTROL_GLYPHS[controller];
    token.dataset.controller = controller;
    token.title = CONTROL_LABELS[controller];

    const baseLabel = baseAccessibleLabel(marker);
    const controlLabel = CONTROL_LABELS[controller];
    marker.setAttribute('aria-label', baseLabel ? `${baseLabel}. ${controlLabel}.` : controlLabel);
    projectedSpaceIds.push(territoryId);
  }

  return {
    formationMarkers: projectedFormationIds.length,
    controlMarkers: projectedSpaceIds.length,
    projectedFormationIds,
    projectedSpaceIds
  };
}
