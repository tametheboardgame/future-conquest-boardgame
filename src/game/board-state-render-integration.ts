import type { BoardRenderProjection } from './board-state-render-projection';
import type { GameState } from './types';

/**
 * Apply authoritative BG2 ownership and piece placement to a renderer-only
 * legacy GameState snapshot. The legacy simulation state remains untouched.
 *
 * Neutral board spaces deliberately preserve the retained renderer's existing
 * control colour because the legacy map has no neutral controller vocabulary.
 * BG4 can introduce a dedicated neutral presentation when board spaces are
 * fully populated without changing this integration boundary.
 *
 * Board pieces only relocate retained formations whose IDs already exist in the
 * legacy renderer model. Matching pieces that are authoritative but off-board,
 * or placed in a space the retained map cannot render, are suppressed rather
 * than left visible at a stale legacy location. BG2E does not invent synthetic
 * legacy combat values or expose hidden enemy detail merely to make a miniature
 * appear.
 */
export function applyBoardProjectionToRendererState(
  legacyState: GameState,
  projection: BoardRenderProjection
): GameState {
  let territories = legacyState.territories;
  let taskGroups = legacyState.taskGroups;
  let enemyFormations = legacyState.enemyFormations;

  for (const [spaceId, controller] of Object.entries(projection.spaceControllers)) {
    const territory = territories[spaceId];
    if (!territory || controller === 'neutral' || territory.controller === controller) continue;
    if (territories === legacyState.territories) territories = { ...legacyState.territories };
    territories[spaceId] = { ...territory, controller };
  }

  for (const piece of projection.pieces) {
    const spaceId = piece.spaceId;

    if (piece.controller === 'player') {
      const group = taskGroups[piece.id];
      if (!group) continue;
      if (!spaceId || !legacyState.territories[spaceId]) {
        if (taskGroups === legacyState.taskGroups) taskGroups = { ...legacyState.taskGroups };
        delete taskGroups[piece.id];
        continue;
      }
      if (group.location === spaceId) continue;
      if (taskGroups === legacyState.taskGroups) taskGroups = { ...legacyState.taskGroups };
      taskGroups[piece.id] = { ...group, location: spaceId };
      continue;
    }

    const formation = enemyFormations[piece.id];
    if (!formation) continue;
    if (!spaceId || !legacyState.territories[spaceId]) {
      if (enemyFormations === legacyState.enemyFormations) enemyFormations = { ...legacyState.enemyFormations };
      delete enemyFormations[piece.id];
      continue;
    }
    if (formation.location === spaceId) continue;
    if (enemyFormations === legacyState.enemyFormations) enemyFormations = { ...legacyState.enemyFormations };
    enemyFormations[piece.id] = { ...formation, location: spaceId };
  }

  if (
    territories === legacyState.territories
    && taskGroups === legacyState.taskGroups
    && enemyFormations === legacyState.enemyFormations
  ) {
    return legacyState;
  }

  return {
    ...legacyState,
    territories,
    taskGroups,
    enemyFormations
  };
}
