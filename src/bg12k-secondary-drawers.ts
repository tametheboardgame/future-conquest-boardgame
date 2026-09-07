const SNAPSHOT_CLASS = 'bg12k-map-underlay';
const SECONDARY_VIEWS = new Set(['forces', 'campaign']);

function stripInteractiveIdentity(root: HTMLElement) {
  root.removeAttribute('id');
  root.querySelectorAll<HTMLElement>('[id]').forEach(node => node.removeAttribute('id'));
  root.querySelectorAll<HTMLElement>('button, input, select, textarea, a, [tabindex]').forEach(node => {
    node.setAttribute('tabindex', '-1');
    node.setAttribute('aria-hidden', 'true');
  });
}

function cloneMapStage(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add(SNAPSHOT_CLASS);
  clone.dataset.bg12kMapUnderlay = 'true';
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('inert', '');
  stripInteractiveIdentity(clone);

  const sourceCanvases = source.querySelectorAll<HTMLCanvasElement>('canvas');
  const clonedCanvases = clone.querySelectorAll<HTMLCanvasElement>('canvas');
  sourceCanvases.forEach((canvas, index) => {
    const target = clonedCanvases[index];
    if (!target) return;
    target.width = canvas.width;
    target.height = canvas.height;
    try {
      target.getContext('2d')?.drawImage(canvas, 0, 0);
    } catch {
      // DOM/SVG map layers still preserve the board if a protected WebGL
      // framebuffer cannot be copied by the browser.
    }
  });

  return clone;
}

function activeCommandView(): string | null {
  return document.querySelector<HTMLElement>('.command-app-shell .command-stage')?.className
    .match(/command-stage-([a-z-]+)/)?.[1] ?? null;
}

export function installBg12kSecondaryDrawers() {
  let cachedMap: HTMLElement | null = null;
  let syncFrame: number | null = null;

  const removeMountedSnapshot = () => {
    document.querySelectorAll(`.${SNAPSHOT_CLASS}`).forEach(node => node.remove());
  };

  const cacheVisibleMap = () => {
    const mapStage = document.querySelector<HTMLElement>('.command-app-shell .command-stage-map');
    if (!mapStage) return;
    cachedMap = cloneMapStage(mapStage);
  };

  const sync = () => {
    syncFrame = null;
    const view = activeCommandView();
    if (view === 'map') {
      removeMountedSnapshot();
      cacheVisibleMap();
      return;
    }
    if (!view || !SECONDARY_VIEWS.has(view)) {
      removeMountedSnapshot();
      return;
    }

    const boardZone = document.querySelector<HTMLElement>('.bg12e-board-zone');
    if (!boardZone || boardZone.querySelector(`:scope > .${SNAPSHOT_CLASS}`) || !cachedMap) return;
    // Mount the already-copied snapshot itself. Cloning a canvas element does
    // not copy its bitmap, so a second clone would turn a captured WebGL board
    // into a blank canvas even though the source snapshot was valid.
    boardZone.prepend(cachedMap);
  };

  const scheduleSync = () => {
    if (syncFrame !== null) return;
    syncFrame = window.requestAnimationFrame(sync);
  };

  const closeTopmostSecondaryAide = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;

    const settingsClose = document.querySelector<HTMLButtonElement>('.global-settings-panel .settings-close');
    if (settingsClose) {
      settingsClose.click();
      return;
    }

    const view = activeCommandView();
    if (!view || !SECONDARY_VIEWS.has(view)) return;
    document.querySelector<HTMLButtonElement>(`[data-command-view="${view}"]`)?.click();
  };

  const observer = new MutationObserver(scheduleSync);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', closeTopmostSecondaryAide);
    sync();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    document.removeEventListener('keydown', closeTopmostSecondaryAide);
    if (syncFrame !== null) window.cancelAnimationFrame(syncFrame);
  }, { once: true });
}
