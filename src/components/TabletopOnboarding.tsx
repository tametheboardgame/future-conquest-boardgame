import { useEffect, useState } from 'react';
import './tabletop-onboarding.css';

type OnboardingStep = {
  title: string;
  copy: string;
  selector: string;
};

const STORAGE_KEY = 'future-conquest-bg11-onboarding-v1';

const STEPS: OnboardingStep[] = [
  {
    title: 'Win the Central Front',
    copy: 'The campaign lasts up to eight rounds. The Expedition is trying to take and hold Paris, Brussels and Rhine-Ruhr; the Defenders are trying to stop the breakthrough. Campaign status always shows objective control and breakthrough pressure.',
    selector: '.tabletop-campaign-status'
  },
  {
    title: 'Spend Command Actions deliberately',
    copy: 'Successful Move, Attack, Recover, Engineer and Logistics actions normally cost 1 Command Action. Strategic cards are free exceptions. Invalid actions cost nothing, and the interface explains why they are unavailable.',
    selector: '.tabletop-status-grid'
  },
  {
    title: 'Move pieces directly on the map',
    copy: 'Select one of your formations on the map. Legal adjacent destinations highlight clearly; blocked destinations stay identifiable and explain the rule preventing movement. Preview the destination, then confirm the Move.',
    selector: '.tabletop-activation-panel'
  },
  {
    title: 'Combat is visible dice combat',
    copy: 'Choose an attacking formation and an adjacent enemy target. Before committing, the combat panel shows the D20 target, supply, terrain and fortification modifiers, plus the possible outcomes.',
    selector: '.tabletop-combat-panel'
  },
  {
    title: 'Use support and cards when they matter',
    copy: 'Recover repairs damage and readiness, Engineer fortifies a position, and Logistics improves supply. Your strategic cards provide one-shot exceptions around the same authoritative board actions. Disabled controls show their current reason instead of failing silently.',
    selector: '.tabletop-support-panel'
  }
];

function readCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'complete';
  } catch {
    return false;
  }
}

function persistCompleted() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'complete');
  } catch {
    // Onboarding remains usable when storage is unavailable.
  }
}

export function TabletopOnboarding() {
  const [open, setOpen] = useState(() => !readCompleted());
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  useEffect(() => {
    document.documentElement.classList.add('bg11-boardgame-onboarding-installed');
    return () => document.documentElement.classList.remove('bg11-boardgame-onboarding-installed');
  }, []);

  useEffect(() => {
    if (!open) return;
    const target = document.querySelector<HTMLElement>(step.selector);
    target?.classList.add('bg11-onboarding-focus');
    return () => target?.classList.remove('bg11-onboarding-focus');
  }, [open, step.selector]);

  const restart = () => {
    setStepIndex(0);
    setOpen(true);
  };

  const finish = () => {
    persistCompleted();
    setStepIndex(0);
    setOpen(false);
  };

  const next = () => {
    if (stepIndex >= STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex(current => current + 1);
  };

  return <>
    <button
      type="button"
      className="tabletop-guide-button"
      aria-expanded={open}
      aria-controls="tabletop-onboarding-card"
      onClick={open ? finish : restart}
      title={open ? 'Close the board-game guide' : 'Replay the board-game guide'}
    >
      {open ? 'Close guide' : 'Guide'}
    </button>

    {open && <aside
      id="tabletop-onboarding-card"
      className="tabletop-onboarding-card"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tabletop-onboarding-title"
      data-bg-package="BG11A"
    >
      <header>
        <span>FIRST TURN GUIDE · {stepIndex + 1}/{STEPS.length}</span>
        <strong id="tabletop-onboarding-title">{step.title}</strong>
      </header>
      <p>{step.copy}</p>
      <div className="tabletop-onboarding-progress" aria-hidden="true">
        {STEPS.map((_, index) => <i key={index} className={index <= stepIndex ? 'active' : ''} />)}
      </div>
      <footer>
        <button type="button" className="quiet" onClick={finish}>Skip guide</button>
        <div>
          <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex(current => Math.max(0, current - 1))}>Back</button>
          <button type="button" className="primary" onClick={next}>{stepIndex === STEPS.length - 1 ? 'Start playing' : 'Next'}</button>
        </div>
      </footer>
    </aside>}
  </>;
}
