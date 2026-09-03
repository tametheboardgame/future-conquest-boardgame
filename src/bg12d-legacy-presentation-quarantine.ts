export const BG12D_LEGACY_UI_QUERY = 'legacy-ui';

export function bg12dLegacyUiRequested(search?: string) {
  const source = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  return new URLSearchParams(source).get(BG12D_LEGACY_UI_QUERY) === '1';
}

export function installBg12dLegacyPresentationQuarantine() {
  if (typeof document === 'undefined') return false;

  const legacyUi = bg12dLegacyUiRequested();
  const root = document.documentElement;
  root.classList.toggle('bg12d-board-ui', !legacyUi);
  root.classList.toggle('bg12d-legacy-ui', legacyUi);
  root.dataset.bg12dPresentation = legacyUi ? 'legacy-diagnostics' : 'board-game';
  return legacyUi;
}
