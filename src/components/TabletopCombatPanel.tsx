import { useEffect, useMemo, useState } from 'react';
import { getBoardCombatPreview, getBoardCombatTargets } from '../game/board-combat';
import { TERRITORIES } from '../game/data';
import { useBoardGameDispatch, useBoardGameState } from './BoardGameStateProvider';
import '../bg5-dice-combat.css';

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

function hitChance(target: number, attackModifier: number): { minimumDie: number; percent: number } {
  const minimumDie = target - attackModifier;
  const successfulFaces = Math.max(0, Math.min(20, 21 - Math.max(1, minimumDie)));
  return {
    minimumDie,
    percent: successfulFaces * 5
  };
}

function quarantineLegacySimulationAttackControls() {
  for (const element of document.querySelectorAll<HTMLButtonElement>(LEGACY_ATTACK_SELECTOR)) {
    element.disabled = true;
    element.setAttribute('aria-hidden', 'true');
    element.dataset.bg5LegacyCombatQuarantined = 'true';
  }
}

export function TabletopCombatPanel() {
  const boardState = useBoardGameState();
  const dispatchBoardAction = useBoardGameDispatch();
  const [attackerPieceId, setAttackerPieceId] = useState<string>('');
  const [defenderPieceId, setDefenderPieceId] = useState<string>('');
  const [feedback, setFeedback] = useState('Select one of your formations, then choose an adjacent enemy piece.');
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
  const chance = preview?.legal ? hitChance(preview.target, preview.attackModifier) : null;

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
        ? `${directTarget.defenderPieceId} selected from ${contactTargets.length} legal enemy pieces at ${territoryLabel(enemySpaceId)} using stable piece order. Review the D20 preview.`
        : `${directTarget.defenderPieceId} selected directly at ${territoryLabel(enemySpaceId)}. Review the D20 preview.`);
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
      ? `${attackerPieceId} can attack ${pieceId}. Review the D20 target and modifiers before confirming.`
      : nextPreview.reason);
  };

  const confirmAttack = () => {
    if (!attackerPieceId || !defenderPieceId || !preview?.legal) return;
    const result = dispatchBoardAction({
      type: 'attack-piece',
      attackerPieceId,
      defenderPieceId
    });
    setFeedback(result.reason);
    if (result.accepted) setDefenderPieceId('');
  };

  const latestCombat = boardState.combat?.status === 'resolved' ? boardState.combat : null;
  const result = latestCombat?.roll;
  const consequence = latestCombat?.consequence;
  const resultModifier = latestCombat?.modifiers.supply ?? 0;

  return <aside
    className="tabletop-combat-panel"
    aria-label="Dice combat"
    data-bg-combat="BG5C"
    data-bg-dice-presentation="BG11C"
  >
    <header>
      <span>Dice Combat</span>
      <strong>{activeSeat.controller === 'computer' ? 'Computer activation' : '1 Command Action'}</strong>
    </header>

    <label className="tabletop-combat-attacker">
      <span>Attacking formation</span>
      <select
        value={attackerPieceId}
        disabled={boardState.phase !== 'activation' || activeSeat.controller !== 'human'}
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
            onClick={() => selectDefender(target.defenderPieceId)}
          >
            <span>{target.defenderPieceId} · {territoryLabel(target.targetSpaceId)}</span>
            <small>R{defender.readiness} · D{defender.damage}/3 · target {target.target}+</small>
          </button>;
        })
        : <p>No legal adjacent enemy target.</p>}
    </section>}

    {preview?.legal && chance && <section className="tabletop-combat-preview" aria-label="Combat preview">
      <div className="tabletop-combat-die">
        <div className="tabletop-d20-face preview" aria-hidden="true"><strong>D20</strong></div>
        <div className="tabletop-combat-die-copy">
          <span>Need {chance.minimumDie}+ on die</span>
          <b>{chance.percent}% hit chance</b>
        </div>
      </div>
      <div className="tabletop-roll-equation" aria-label={`Roll one D20 ${signed(preview.attackModifier)} against target ${preview.target}`}>
        <span>1D20</span><b>{signed(preview.attackModifier)}</b><em>vs</em><strong>{preview.target}</strong>
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
      <button type="button" className="confirm" onClick={confirmAttack}>Roll D20 · 1 Command Action</button>
    </section>}

    <p className="tabletop-combat-feedback" role="status">{feedback}</p>

    {result && consequence && <section
      key={`${latestCombat?.attackerPieceId}-${latestCombat?.defenderPieceId}-${result.die}-${result.attackTotal}`}
      className={`tabletop-combat-result ${result.outcome}${consequence.critical ? ' critical' : ''}`}
      aria-label="Latest combat result"
      aria-live="polite"
    >
      <div className="tabletop-combat-result-roll">
        <div className="tabletop-d20-face resolved" aria-label={`D20 rolled ${result.die}`}>
          <strong>{result.die}</strong><small>D20</small>
        </div>
        <div className="tabletop-combat-result-summary">
          <span className="tabletop-combat-outcome">{consequence.critical ? '★ CRITICAL HIT' : result.outcome === 'hit' ? '✓ HIT' : '× MISS'}</span>
          <strong>{result.attackTotal} vs {result.target}</strong>
          <small>{result.die} {signed(resultModifier)} = {result.attackTotal}</small>
        </div>
      </div>
      <p>{latestCombat?.attackerPieceId} → {latestCombat?.defenderPieceId}: {consequence.critical ? 'critical ' : ''}{consequence.defenderStatus}.</p>
      <div className="tabletop-combat-consequences" aria-label="Combat consequences">
        <b>Damage +{consequence.damageInflicted}</b>
        <b>Readiness -{consequence.readinessLoss}</b>
        {consequence.retreatSpaceId && <b>Retreat {territoryLabel(consequence.retreatSpaceId)}</b>}
        {consequence.controlChanged && <b>Control changed</b>}
      </div>
    </section>}
  </aside>;
}
