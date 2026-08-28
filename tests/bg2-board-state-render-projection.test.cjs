const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitialBoardState, serializeBoardState } = require('../.test-dist/board-state.js');
const { projectBoardStateForRenderer } = require('../.test-dist/board-state-render-projection.js');

test('BG2C projects authoritative board state into a deterministic renderer-friendly shape', () => {
  const state = createInitialBoardState({ seed: 20260825 });
  state.seats['seat-1'].commandActionsRemaining = 3;
  state.phase = 'activation';
  state.spaces = {
    paris: { id: 'paris', control: 'seat-2' },
    portal: { id: 'portal', control: 'seat-1' },
    rhine: { id: 'rhine', control: null }
  };
  state.pieces = {
    zulu: { id: 'zulu', seatId: 'seat-2', spaceId: 'paris', readiness: 4, damage: 1, supply: 'strained' },
    alpha: { id: 'alpha', seatId: 'seat-1', spaceId: 'portal', readiness: 5, damage: 0, supply: 'supplied' }
  };

  const before = serializeBoardState(state);
  const projection = projectBoardStateForRenderer(state);

  assert.deepEqual(projection, {
    scenarioId: 'central-front',
    sourceSeed: 20260825,
    round: 1,
    phase: 'activation',
    activeSeat: 'seat-1',
    commandActionsRemaining: 3,
    spaceControllers: {
      paris: 'enemy',
      portal: 'player',
      rhine: 'neutral'
    },
    pieces: [
      { id: 'alpha', seatId: 'seat-1', spaceId: 'portal', controller: 'player', readiness: 5, damage: 0, supply: 'supplied' },
      { id: 'zulu', seatId: 'seat-2', spaceId: 'paris', controller: 'enemy', readiness: 4, damage: 1, supply: 'strained' }
    ]
  });
  assert.equal(serializeBoardState(state), before);
});

test('BG2C supports alternate local/player seat ownership without renderer changes', () => {
  const state = createInitialBoardState({ seed: 9 });
  state.spaces = {
    london: { id: 'london', control: 'seat-4' },
    kyiv: { id: 'kyiv', control: 'seat-1' }
  };
  state.pieces = {
    coalition: { id: 'coalition', seatId: 'seat-4', spaceId: 'london', readiness: 5, damage: 0, supply: 'supplied' },
    invader: { id: 'invader', seatId: 'seat-1', spaceId: 'kyiv', readiness: 5, damage: 0, supply: 'supplied' }
  };

  const projection = projectBoardStateForRenderer(state, { playerSeatIds: ['seat-4'] });
  assert.equal(projection.spaceControllers.london, 'player');
  assert.equal(projection.spaceControllers.kyiv, 'enemy');
  assert.equal(projection.pieces.find(piece => piece.id === 'coalition').controller, 'player');
  assert.equal(projection.pieces.find(piece => piece.id === 'invader').controller, 'enemy');
});

test('BG2C orders renderer IDs by stable code-unit comparison rather than host locale', () => {
  const state = createInitialBoardState({ seed: 11 });
  state.spaces = {
    'ä-space': { id: 'ä-space', control: 'seat-1' },
    'z-space': { id: 'z-space', control: 'seat-2' },
    'Å-space': { id: 'Å-space', control: null }
  };
  state.pieces = {
    'ä-piece': { id: 'ä-piece', seatId: 'seat-1', spaceId: 'ä-space', readiness: 5, damage: 0, supply: 'supplied' },
    'z-piece': { id: 'z-piece', seatId: 'seat-2', spaceId: 'z-space', readiness: 5, damage: 0, supply: 'supplied' },
    'Å-piece': { id: 'Å-piece', seatId: 'seat-3', spaceId: 'Å-space', readiness: 5, damage: 0, supply: 'supplied' }
  };

  const projection = projectBoardStateForRenderer(state);

  assert.deepEqual(Object.keys(projection.spaceControllers), ['z-space', 'Å-space', 'ä-space']);
  assert.deepEqual(projection.pieces.map(piece => piece.id), ['z-piece', 'Å-piece', 'ä-piece']);
});
