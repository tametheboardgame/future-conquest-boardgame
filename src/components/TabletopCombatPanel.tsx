import { useEffect, useMemo, useRef, useState } from 'react';
import { getBoardCombatHitChance, getBoardCombatPreview, getBoardCombatTargets } from '../game/board-combat';
import { TERRITORIES } from '../game/data';
import { useBoardGameDispatch, useBoardGameState } from './BoardGameStateProvider';
import { Bg12gIntegratedDiceRenderer } from './Bg12gIntegratedDiceRenderer';
import '../bg5-dice-combat.css';
import '../bg12g-dice-tray.css';

const MAP_PIECE_SELECTOR = '.r3-terrain-task-group-marker[data-group-id], .task-group-marker';
const MAP_ENEMY_CONTACT_SELECTOR = '.r3-terrain-enemy-contact[data-territory-id]';
const LEGACY_ATTACK_SELECTOR = '[data-tutorial="attack-action"]';

function territoryLabel(spaceId: string | null | undefined): string {
  if (!spaceId) return 'Off board';
  const territory = TERRITORIES[spaceId];
  if (!territory) return spaceId;
  return `${territory.centre} · ${territory.name}`;
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

function readEnemyContactSpaceId(target: Element): string | null {
  const marker = target.closest(MAP_ENEMY_CONTACT_SELECTOR) as HTMLElement | null;
  return marker?.dataset.territoryId ?? null;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatPercent(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

function quarantineLegacySimulationAttackControls() {
  for (const element of document.querySelectorAll<HTMLButtonElement>(LEGACY_ATTACK_SELECTOR)) {
    element.disabled = true;
    element.setAttribute('aria-hidden', 'true');
    element.dataset.bg5LegacyCombatQuarantined = 'true';
  }
}

function fireDiceClatterHook(phase: 'start' | 'settled', dice?: [number, number], total?: number) {
  window.dispatchEvent(new CustomEvent('future-conquest:dice-clatter', {
    detail: { diceType: '2d6', phase, dice, total }
  }));
}

export function TabletopCombatPanel() {
  const boardState = useBoardGameState();
  const dispatchBoardAction = useBoardGameDispatch();
  const [attackerPieceId, setAttackerPieceId] = useState<string>('');
  const [defenderPieceId, setDefenderPieceId] = useState<string>('');
  const [feedback, setFeedback] = useState('Select one of your formations, then choose an adjacent enemy piece.');
  const [rollPhase, setRollPhase] = useState<'idle' | 'rolling' | 'settled'>('idle');
  const [revealedCombatKey, setRevealedCombatKey] = useState('');
  const rollRequestedRef = useRef(false);
  const activeSeat = boardState.seats[boardState.activeSeat];

  const availableAttackers = useMemo(
    () => Object.values(boardState.pieces)
      .filter(piece => piece.seatId === boardState.activeSeat && piece.spaceId)
      .sort((a, b) => a.id.localeCompare(b.id)),
    [boardState.activeSeat, boardState.pieces]
  );

  const selectedAttacker = attackerPieceId ? boardState.pieces[attackerPieceId] : undefined;
  const targets = useMemo(
    () => attackerPieceId ? getBoardCombatTargets(boardState, attackerPieceId) : [],
    [attackerPieceId, boardState]
  );
  const preview = useMemo(
    () => attackerPieceId && defenderPieceId
      ? getBoardCombatPreview(boardState, attackerPieceId, defenderPieceId)
      : null,
    [attackerPieceId, boardState, defenderPieceId]
  );
  const chance = preview?.legal ? getBoardCombatHitChance(preview.target, preview.attackModifier) : null;
  const latestCombat = boardState.combat?.status === 'resolved' ? boardState.combat : null;
  const result = latestCombat?.roll;
  const consequence = latestCombat?.consequence;
  const resultModifier = latestCombat?.modifiers.supply ?? 0;
  const authoritativeDice = result?.dice ?? null;
  const latestCombatKey = latestCombat
    ? `${latestCombat.attackerPieceId}-${latestCombat.defenderPieceId}-${result?.die}-${result?.attackTotal}-${boardState.rng.calls}`
    : '';
  const resultRevealed = Boolean(latestCombatKey && revealedCombatKey === latestCombatKey && result && consequence);

  useEffect(() => {
    quarantineLegacySimulationAttackControls();
    const observer = new MutationObserver(quarantineLegacySimulationAttackControls);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled']
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!latestCombatKey || !result) return;
    if (!rollRequestedRef.current || !result.dice) {
      setRevealedCombatKey(latestCombatKey);
      setRollPhase('settled');
      rollRequestedRef.current = false;
    }
  }, [latestCombatKey, result]);

  useEffect(() => {
    if (boardState.phase !== 'activation' || activeSeat.controller !== 'human') {
      setAttackerPieceId('');
      setDefenderPieceId('');
      return;
    }
    if (attackerPieceId && boardState.pieces[attackerPieceId]?.seatId === boardState.activeSeat) return;
    setAttackerPieceId('');
    setDefenderPieceId('');
  }, [activeSeat.controller, attackerPieceId, boardState.activeSeat, boardState.phase, boardState.pieces]);

  useEffect(() => {
    const onMapCombatClick = (event: MouseEvent) => {
      if (boardState.phase !== 'activation' || activeSeat.controller !== 'human') return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest(MAP_PIECE_SELECTOR)) {
        const pieceId = readMapPieceId(target);
        if (!pieceId) return;
        const piece = boardState.pieces[pieceId];
        if (!piece || piece.seatId !== boardState.activeSeat) return;
        setAttackerPieceId(pieceId);
        setDefenderPieceId('');
        const legalTargets = getBoardCombatTargets(boardState, pieceId);
        setFeedback(legalTargets.length
          ? `${pieceId} selected for combat. ${legalTargets.length} adjacent enemy ${legalTargets.length === 1 ? 'target is' : 'targets are'} legal.`
          : `${pieceId} selected. No adjacent enemy piece can currently be attacked.`);
        return;
      }

      const enemySpaceId = readEnemyContactSpaceId(target);
      if (!enemySpaceId) return;
      if (!attackerPieceId) {
        setFeedback(`Enemy contact at ${territoryLabel(enemySpaceId)} selected. Choose an attacking formation first.`);
        return;
      }

      const contactTargets = getBoardCombatTargets(boardState, attackerPieceId)
        .filter(candidate => candidate.targetSpaceId === enemySpaceId);
      const directTarget = contactTargets[0];
      if (!directTarget) {
        setDefenderPieceId('');
        setFeedback(`${territoryLabel(enemySpaceId)} contains no legal adjacent board-game target for ${attackerPieceId}.`);
        return;
      }

      setDefenderPieceId(directTarget.defenderPieceId);
      setFeedback(contactTargets.length > 1
        ? `${directTarget.defenderPieceId} selected from ${contactTargets.length} legal enemy pieces at ${territoryLabel(enemySpaceId)} using stable piece order. Review the 2D6 preview.`
        : `${directTarget.defenderPieceId} selected directly at ${territoryLabel(enemySpaceId)}. Review the 2D6 preview.`);
    };

    document.addEventListener('click', onMapCombatClick, true);
    return () => document.removeEventListener('click', onMapCombatClick, true);
  }, [activeSeat.controller, attackerPieceId, boardState]);

  const selectAttacker = (pieceId: string) => {
    setAttackerPieceId(pieceId);
    setDefenderPieceId('');
    const legalTargets = pieceId ? getBoardCombatTargets(boardState, pieceId) : [];
    setFeedback(pieceId
      ? legalTargets.length
        ? `${pieceId} selected. Choose an adjacent enemy target on the map or in the target list.`
        : `${pieceId} has no legal adjacent combat target.`
      : 'Select one of your formations, then choose an adjacent enemy piece.');
  };

  const selectDefender = (pieceId: string) => {
    setDefenderPieceId(pieceId);
    const nextPreview = getBoardCombatPreview(boardState, attackerPieceId, pieceId);
    setFeedback(nextPreview.legal
      ? `${attackerPieceId} can attack ${pieceId}. Review the 2D6 target and modifiers before confirming.`
      : nextPreview.reason);
  };

  const confirmAttack = () => {
    if (!attackerPieceId || !defenderPieceId || !preview?.legal || rollPhase === 'rolling') return;
    rollRequestedRef.current = true;
    setRollPhase('rolling');
    setRevealedCombatKey('');
    fireDiceClatterHook('start');
    const attackTarget = defenderPieceId;
    const actionResult = dispatchBoardAction({
      type: 'attack-piece',
      attackerPieceId,
      defenderPieceId: attackTarget
    });
    setFeedback(actionResult.reason);
    if (actionResult.accepted) {
      setDefenderPieceId('');
      return;
    }
    rollRequestedRef.current = false;
    setRollPhase('idle');
  };

  const settleAuthoritativeRoll = (settledDice: [number, number], settledTotal: number) => {
    if (!rollRequestedRef.current || !latestCombatKey || !result?.dice) return;
    const matchesAuthority = result.dice[0] === settledDice[0]
      && result.dice[1] === settledDice[1]
      && result.die === settledTotal;
    if (!matchesAuthority) return;
    rollRequestedRef.current = false;
    setRevealedCombatKey(latestCombatKey);
    setRollPhase('settled');
    fireDiceClatterHook('settled', settledDice, settledTotal);
  };

  const handleDiceRendererFailure = () => {
    setFeedback('3D dice renderer unavailable. Combat resolved normally and the authoritative dice are shown using the static fallback.');
  };

  const resultAriaLabel = rollPhase === 'rolling'
    ? 'Rolling two D6'
    : authoritativeDice
      ? `Two D6 rolled ${authoritativeDice[0]} and ${authoritativeDice[1]}, total ${result?.die}`
      : `Legacy D20 rolled ${result?.die ?? 0}`;

  const screenReaderResult = rollPhase === 'rolling'
    ? 'Rolling two D6.'
    : resultRevealed && authoritativeDice && result && consequence
      ? `Roll result ${authoritativeDice[0]} and ${authoritativeDice[1]}, total ${result.die}. ${consequence.critical ? 'Critical hit.' : result.outcome === 'hit' ? 'Hit.' : 'Miss.'}`
      : '';

  return <aside
    className="tabletop-combat-panel bg12g-dice-tray-panel"
    aria-label="Dice combat"
    data-bg-combat="BG5C"
    data-bg-dice-presentation="BG11C"
    data-bg-physical-dice="BG12G"
    data-bg-dice-model="BG12G-R-2D6"
    data-bg-dice-renderer="BG12G-R2C-THREE"
  >
    <header>
      <span>Dice Combat</span>
      <strong>{activeSeat.controller === 'computer' ? 'Computer activation' : '1 Command Action'}</strong>
    </header>

    <label className="tabletop-combat-attacker">
      <span>Attacking formation</span>
      <select
        value={attackerPieceId}
        disabled={boardState.phase !== 'activation' || activeSeat.controller !== 'human' || rollPhase === 'rolling'}
        onChange={event => selectAttacker(event.target.value)}
      >
        <option value="">Select formation</option>
        {availableAttackers.map(piece => <option key={piece.id} value={piece.id}>
          {piece.id} · {territoryLabel(piece.spaceId)} · R{piece.readiness} · D{piece.damage}
        </option>)}
      </select>
    </label>

    {selectedAttacker && <div className="tabletop-combat-piece-status">
      <span>{territoryLabel(selectedAttacker.spaceId)}</span>
      <small>Readiness {selectedAttacker.readiness} · Damage {selectedAttacker.damage}/3 · Supply {selectedAttacker.supply}</small>
    </div>}

    {attackerPieceId && <section className="tabletop-combat-targets" aria-label="Legal combat targets">
      <div className="tabletop-combat-section-heading">
        <strong>Adjacent targets</strong>
        <span>{targets.length} legal</span>
      </div>
      {targets.length
        ? targets.map(target => {
          const defender = boardState.pieces[target.defenderPieceId];
          return <button
            type="button"
            key={target.defenderPieceId}
            className={target.defenderPieceId === defenderPieceId ? 'selected' : ''}
            disabled={rollPhase === 'rolling'}
            onClick={() => selectDefender(target.defenderPieceId)}
          >
            <span>{target.defenderPieceId} · {territoryLabel(target.targetSpaceId)}</span>
            <small>R{defender.readiness} · D{defender.damage}/3 · target {target.target}+</small>
          </button>;
        })
        : <p>No legal adjacent enemy target.</p>}
    </section>}

    {preview?.legal && chance && <section className="tabletop-combat-preview bg12g-pre-roll" aria-label="Combat preview">
      <div className="bg12g-tray" aria-label="Two D6 dice tray ready to roll">
        <div className="bg12g-tray-rim" aria-hidden="true" />
        <Bg12gIntegratedDiceRenderer dice={null} />
        <div className="bg12g-tray-copy">
          <span>Need {chance.minimumDiceTotal}+ on 2D6</span>
          <b>{formatPercent(chance.percent)}% hit chance</b>
        </div>
      </div>
      <div className="tabletop-roll-equation" aria-label={`Roll two D6 ${signed(preview.attackModifier)} against target ${preview.target}`}>
        <span>2D6</span><b>{signed(preview.attackModifier)}</b><em>vs</em><strong>{preview.target}</strong>
      </div>
      <dl>
        <div><dt>Base target</dt><dd>{preview.baseTarget}</dd></div>
        <div><dt>Supply attack</dt><dd>{signed(preview.modifiers.supply)}</dd></div>
        <div><dt>Terrain defence</dt><dd>+{preview.modifiers.terrain}</dd></div>
        <div><dt>Fortification</dt><dd>+{preview.modifiers.fortification}</dd></div>
      </dl>
      <details>
        <summary>Possible outcomes</summary>
        <ul>{preview.possibleOutcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
      </details>
      <button type="button" className="confirm bg12g-roll-button" onClick={confirmAttack}>Roll 2D6 · 1 Command Action</button>
    </section>}

    <p className="tabletop-combat-feedback" role="status">{feedback}</p>

    {latestCombat && result && consequence && <section
      key={latestCombatKey}
      className={`tabletop-combat-result bg12g-resolved-tray ${result.outcome}${consequence.critical ? ' critical' : ''} ${rollPhase}`}
      aria-label="Latest combat result"
    >
      <p className="bg12g-dice-sr-only" role="status" aria-live="polite" aria-atomic="true">{screenReaderResult}</p>
      <div className="bg12g-tray" aria-label={resultAriaLabel}>
        <div className="bg12g-tray-rim" aria-hidden="true" />
        {authoritativeDice
          ? <Bg12gIntegratedDiceRenderer
              dice={authoritativeDice}
              animate={rollPhase === 'rolling'}
              onSettled={settleAuthoritativeRoll}
              onRendererFailure={handleDiceRendererFailure}
            />
          : <div className="bg12g-legacy-roll" aria-label={`Legacy D20 result ${result.die}`}>
              <span>Legacy saved combat</span>
              <b>D20 · {result.die}</b>
            </div>}
        <div className="bg12g-tray-copy bg12g-roll-state">
          {rollPhase === 'rolling'
            ? <><span>Rolling two D6</span><b className="bg12g-rolling-dots" aria-hidden="true">•••</b></>
            : authoritativeDice
              ? <><span>Authoritative roll</span><b>{authoritativeDice[0]} + {authoritativeDice[1]} = {result.die}</b></>
              : <><span>Legacy authoritative roll</span><b>{result.die}</b></>}
        </div>
      </div>

      {resultRevealed && <>
        <div className="tabletop-combat-result-summary bg12g-result-summary">
          <span className="tabletop-combat-outcome">{consequence.critical ? '★ CRITICAL HIT' : result.outcome === 'hit' ? '✓ HIT' : '× MISS'}</span>
          <strong>{result.attackTotal} vs {result.target}</strong>
          <small>{authoritativeDice ? `${authoritativeDice[0]} + ${authoritativeDice[1]} = ${result.die}; ` : `Legacy D20 ${result.die}; `}{result.die} {signed(resultModifier)} = {result.attackTotal}</small>
        </div>
        <p>{latestCombat.attackerPieceId} → {latestCombat.defenderPieceId}: {consequence.critical ? 'critical ' : ''}{consequence.defenderStatus}.</p>
        <div className="tabletop-combat-consequences" aria-label="Combat consequences">
          <b>Damage +{consequence.damageInflicted}</b>
          <b>Readiness -{consequence.readinessLoss}</b>
          {consequence.retreatSpaceId && <b>Retreat {territoryLabel(consequence.retreatSpaceId)}</b>}
          {consequence.controlChanged && <b>Control changed</b>}
        </div>
      </>}

      {rollPhase === 'rolling' && <p className="bg12g-roll-announcement" role="status">Rolling two D6…</p>}
    </section>}
  </aside>;
}
