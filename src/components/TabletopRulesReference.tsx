import { useState } from 'react';
import {
  CENTRAL_FRONT_BREAKTHROUGH_TARGET,
  CENTRAL_FRONT_CAMPAIGN_OBJECTIVES,
  CENTRAL_FRONT_FINAL_OBJECTIVE_TARGET,
  projectBoardCampaignStatus
} from '../game/board-campaign';
import { useBoardGameState } from './BoardGameStateProvider';
import './tabletop-rules-reference.css';

export function TabletopRulesReference() {
  const state = useBoardGameState();
  const campaign = projectBoardCampaignStatus(state);
  const [open, setOpen] = useState(false);
  const objectiveNames = CENTRAL_FRONT_CAMPAIGN_OBJECTIVES.map(objective => objective.label).join(', ');

  return <>
    <button
      type="button"
      className="tabletop-rules-button"
      aria-expanded={open}
      aria-controls="tabletop-rules-reference"
      onClick={() => setOpen(value => !value)}
    >
      {open ? 'Close rules' : 'Rules'}
    </button>

    {open && <section
      id="tabletop-rules-reference"
      className="tabletop-rules-reference"
      aria-labelledby="tabletop-rules-reference-title"
      data-bg-rules="BG11B"
    >
      <header>
        <span>QUICK REFERENCE</span>
        <strong id="tabletop-rules-reference-title">Central Front rules</strong>
        <p>{campaign.shortLabel}</p>
      </header>

      <details open>
        <summary>Turn & actions</summary>
        <ul>
          <li>Players alternate activations during each round.</li>
          <li>Move, Attack, Recover, Engineer and Logistics each cost 1 Command Action when accepted.</li>
          <li>Invalid actions cost nothing and change nothing.</li>
          <li>Strategic cards are free one-shot exceptions. Pass Activation is free when legal.</li>
        </ul>
      </details>

      <details>
        <summary>Move & combat</summary>
        <ul>
          <li>Select one of your formations directly on the board; legal adjacent Move destinations are highlighted.</li>
          <li>Combat targets must be legal adjacent enemy pieces.</li>
          <li>Combat uses two seeded D6s. Add the two faces, apply the supply modifier, and compare the result with the displayed terrain and fortification defence target before confirming.</li>
          <li>Double six is a critical hit.</li>
          <li>Damage, readiness loss, retreat, elimination and control change are resolved by the authoritative rules engine.</li>
        </ul>
      </details>

      <details>
        <summary>Support & cards</summary>
        <ul>
          <li>Recover repairs a formation when its current state permits it.</li>
          <li>Engineer fortifies an eligible unfortified formation once; fortification does not stack.</li>
          <li>Logistics improves a formation's supply state when legal.</li>
          <li>Disabled support/card controls show the authoritative rejection reason.</li>
        </ul>
      </details>

      <details>
        <summary>Objectives & victory</summary>
        <ul>
          <li>Strategic objectives: {objectiveNames}.</li>
          <li>Holding all three objectives gives the expedition an immediate victory.</li>
          <li>Each objective held at round end adds 1 breakthrough point.</li>
          <li>At the end of round {state.roundLimit}, the expedition wins by holding at least {CENTRAL_FRONT_FINAL_OBJECTIVE_TARGET} objectives, or by reaching {CENTRAL_FRONT_BREAKTHROUGH_TARGET} breakthrough points while still holding at least one objective.</li>
          <li>The defenders win immediately if the expedition has no formation left on the Central Front.</li>
        </ul>
      </details>

      <footer>
        <span>Current objectives</span>
        <p>{campaign.objectiveSummary}</p>
      </footer>
    </section>}
  </>;
}
