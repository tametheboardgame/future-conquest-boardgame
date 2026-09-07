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

function cloneMapWorkspace(source: HTMLElement): HTMLElement {
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
  return document.querySelector<HTMLElement>('.command-stage')?.className
    .match(/command-stage-([a-z-]+)/)?.[1] ?? null;
}

export function installBg12kSecondaryDrawers() {
  let cachedMap: HTMLElement | null = null;

  const removeMountedSnapshot = () => {
    document.querySelectorAll(`.${SNAPSHOT_CLASS}`).forEach(node => node.remove());
  };

  const cacheVisibleMap = () => {
    const map = document.querySelector<HTMLElement>('.command-stage-map .command-map-workspace');
    if (!map) return;
    cachedMap = cloneMapWorkspace(map);
  };

  const sync = () => {
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
    if (!boardZone || boardZone.querySelector(`.${SNAPSHOT_CLASS}`) || !cachedMap) return;
    boardZone.prepend(cachedMap.cloneNode(true));
  };

  const observer = new MutationObserver(() => queueMicrotask(sync));
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
}
