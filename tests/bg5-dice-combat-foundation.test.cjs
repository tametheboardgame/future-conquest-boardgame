const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BOARD_COMBAT_BASE_TARGET,
  BOARD_COMBAT_DIE_COUNT,
  BOARD_COMBAT_DIE_SIDES,
  declareBoardCombat,
  getBoardCombatPreview,
  resolveBoardCombat
} = require('../.test-dist/board-combat.js');
const {
  createInitialBoardState,
  serializeBoardState,
  startBoardRound
} = require('../.test-dist/board-state.js');
const { TERRITORIES } = require('../.test-dist/data.js');

const TERRAIN_MODIFIER = {
  'open-lowland': 0,
  'mixed-lowland': 1,
  'mixed-upland': 2,
  mountainous: 3
};

function startedState(seed = 20260828) {
  return startBoardRound(createInitialBoardState({
    seed,
    controllers: { 'seat-1': 'human', 'seat-2': 'human' }
  })).state;
}

function adjacentEnemy(state, attackerPieceId = 'TG-1') {
  const attacker = state.pieces[attackerPieceId];
  assert.ok(attacker.spaceId);
  const targetSpaceId = state.spaces[attacker.spaceId].adjacentSpaceIds.find(spaceId =>
    Object.values(state.pieces).some(piece => piece.spaceId === spaceId && piece.seatId !== attacker.seatId)
  );
  assert.ok(targetSpaceId);
  const defender = Object.values(state.pieces).find(piece =>
    piece.spaceId === targetSpaceId && piece.seatId !== attacker.seatId
  );
  assert.ok(defender);
  return { attacker, defender, targetSpaceId };
}

test('BG5A exposes a legal adjacent-enemy D20 preview with explicit terrain and fortification modifiers', () => {
  const state = startedState();
  const { defender, targetSpaceId } = adjacentEnemy(state);
  state.spaces[targetSpaceId] = { ...state.spaces[targetSpaceId], fortification: 2 };

  const preview = getBoardCombatPreview(state, 'TG-1', defender.id);

  assert.equal(preview.legal, true);
  assert.equal(preview.dieCount, BOARD_COMBAT_DIE_COUNT);
  assert.equal(preview.dieSides, BOARD_COMBAT_DIE_SIDES);
  assert.equal(preview.baseTarget, BOARD_COMBAT_BASE_TARGET);
  assert.equal(preview.modifiers.supply, 0);
  assert.equal(preview.modifiers.terrain, TERRAIN_MODIFIER[TERRITORIES[targetSpaceId].terrain]);
  assert.equal(preview.modifiers.fortification, 2);
  assert.equal(preview.target, BOARD_COMBAT_BASE_TARGET + preview.modifiers.terrain + 2);
});

test('BG5A declaration locks the visible combat contract without spending an action or consuming RNG', () => {
  const state = startedState();
  const { defender } = adjacentEnemy(state);
  const before = serializeBoardState(state);

  const declared = declareBoardCombat(state, 'TG-1', defender.id);

  assert.equal(declared.accepted, true);
  assert.equal(declared.commandActionsSpent, 0);
  assert.equal(declared.state.combat.status, 'declared');
  assert.equal(declared.state.combat.roll, null);
  assert.equal(declared.state.rng.calls, state.rng.calls);
  assert.equal(declared.state.seats['seat-1'].commandActionsRemaining, 4);
  assert.equal(declared.state.activeSeat, 'seat-1');
  assert.match(declared.state.combat.log[1], /Roll 1D20/);
  assert.equal(serializeBoardState(state), before);
});

test('BG5A resolution uses authoritative seeded RNG, records hit/miss, spends one action and advances activation', () => {
  const state = startedState(11264);
  const { defender } = adjacentEnemy(state);
  const declared = declareBoardCombat(state, 'TG-1', defender.id);
  assert.equal(declared.accepted, true);

  const resolved = resolveBoardCombat(declared.state);

  assert.equal(resolved.accepted, true);
  assert.equal(resolved.commandActionsSpent, 1);
  assert.equal(resolved.state.rng.calls, 1);
  assert.equal(resolved.state.combat.status, 'resolved');
  assert.equal(resolved.state.combat.roll.die, 15);
  assert.equal(resolved.state.combat.roll.outcome, 'hit');
  assert.equal(resolved.state.seats['seat-1'].commandActionsRemaining, 3);
  assert.equal(resolved.state.activeSeat, 'seat-2');
  assert.match(resolved.state.combat.log.at(-1), /HIT/);
});

test('BG5A identical seeds and board positions reproduce the exact same combat roll', () => {
  function resolveOnce() {
    const state = startedState(20260828);
    const { defender } = adjacentEnemy(state);
    return resolveBoardCombat(declareBoardCombat(state, 'TG-1', defender.id).state).state;
  }

  const first = resolveOnce();
  const second = resolveOnce();

  assert.deepEqual(first.combat.roll, second.combat.roll);
  assert.deepEqual(first.rng, second.rng);
  assert.equal(first.combat.roll.die, 3);
  assert.equal(first.combat.roll.outcome, 'miss');
});

test('BG5A supply penalties are visible before commitment and affect the resolved attack total', () => {
  const state = startedState(11264);
  state.pieces['TG-1'] = { ...state.pieces['TG-1'], supply: 'isolated' };
  const { defender } = adjacentEnemy(state);

  const preview = getBoardCombatPreview(state, 'TG-1', defender.id);
  assert.equal(preview.legal, true);
  assert.equal(preview.modifiers.supply, -2);
  assert.equal(preview.attackModifier, -2);

  const resolved = resolveBoardCombat(declareBoardCombat(state, 'TG-1', defender.id).state);
  assert.equal(resolved.state.combat.roll.die, 15);
  assert.equal(resolved.state.combat.roll.attackTotal, 13);
});

test('BG5A rejects friendly and non-adjacent targets without mutation or cost', () => {
  const state = startedState();
  const friendlyBefore = serializeBoardState(state);
  const friendly = declareBoardCombat(state, 'TG-1', 'TG-2');
  assert.equal(friendly.accepted, false);
  assert.equal(friendly.commandActionsSpent, 0);
  assert.match(friendly.reason, /friendly/);
  assert.equal(serializeBoardState(state), friendlyBefore);

  const attackerSpaceId = state.pieces['TG-1'].spaceId;
  const distantEnemy = Object.values(state.pieces).find(piece =>
    piece.seatId !== 'seat-1'
    && piece.spaceId
    && !state.spaces[attackerSpaceId].adjacentSpaceIds.includes(piece.spaceId)
  );
  assert.ok(distantEnemy);
  const distant = declareBoardCombat(state, 'TG-1', distantEnemy.id);
  assert.equal(distant.accepted, false);
  assert.equal(distant.commandActionsSpent, 0);
  assert.match(distant.reason, /not in a space adjacent/);
});

test('BG5A does not roll twice or allow a second declaration while combat is pending', () => {
  const state = startedState();
  const { defender } = adjacentEnemy(state);
  const declared = declareBoardCombat(state, 'TG-1', defender.id);
  assert.equal(declared.accepted, true);

  const secondDeclaration = declareBoardCombat(declared.state, 'TG-2', defender.id);
  assert.equal(secondDeclaration.accepted, false);
  assert.equal(secondDeclaration.commandActionsSpent, 0);
  assert.match(secondDeclaration.reason, /Resolve the currently declared combat/);

  const resolved = resolveBoardCombat(declared.state);
  assert.equal(resolved.accepted, true);
  const secondResolution = resolveBoardCombat(resolved.state);
  assert.equal(secondResolution.accepted, false);
  assert.equal(secondResolution.commandActionsSpent, 0);
  assert.equal(secondResolution.state.rng.calls, 1);
});

test('BG5A preserves pieces on hit until casualty rules are introduced by the next BG5 slice', () => {
  const state = startedState(11264);
  const { defender } = adjacentEnemy(state);
  const originalDefender = { ...defender };
  const resolved = resolveBoardCombat(declareBoardCombat(state, 'TG-1', defender.id).state);

  assert.equal(resolved.state.combat.roll.outcome, 'hit');
  assert.deepEqual(resolved.state.pieces[defender.id], originalDefender);
});