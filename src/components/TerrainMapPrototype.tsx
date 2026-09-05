import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { GeoJSONSource, type GeoJSONSourceSpecification, type Map } from 'maplibre-gl';
import activeGeojson from '../assets/vertical-slice-map.json';
import { useLiveGlobalSettings } from './StartupExperience';
import { useBoardGameState } from './BoardGameStateProvider';
import { getThreatenedTerritories } from '../game/operational-clarity';
import { projectBoardStateForRenderer } from '../game/board-state-render-projection';
import { STRATEGIC_NODES, STRATEGIC_ROUTES } from '../game/strategic-network-data';
import {
  chooseTerrainPresentationProfile,
  terrainCameraForProfile,
  terrainCameraPreset,
  type TerrainCameraPreset,
  type TerrainPresentationProfile
} from '../presentation/r3-terrain-config';
import {
  buildTerrainPoliticalGeoJSON,
  buildTerrainStrategicNodeGeoJSON,
  buildTerrainStrategicRouteGeoJSON
} from '../presentation/r3-terrain-overlay';
import {
  applyR3StrategicInformationOverlay,
  enrichR3StrategicNodeGeoJSON,
  enrichR3StrategicPoliticalGeoJSON,
  R3_RESOURCE_METRIC_OPTIONS,
  R3_STRATEGIC_OVERLAY_OPTIONS,
  r3StrategicOverlayLegend,
  type R3ResourceMetric,
  type R3StrategicOverlay
} from '../presentation/r3-strategic-information-layers';
import { applyBg12iBoardTokens } from '../presentation/bg12i-board-token-projection';
import { terrainOperationalTerritoryCentres } from '../presentation/r3-terrain-operational-markers';
import '../wp3-5-physical-overlay.css';
import '../wp5-strategic-information.css';
import '../r3-wp8-accessibility.css';
import '../bg12i-map-information-tokens.css';
import {
  TerrainMapPrototypeImpl,
  prewarmTerrainRuntime,
  type TerrainMapPrototypeProps
} from './TerrainMapPrototypeImpl';

const STRATEGIC_PREFERENCES_KEY = 'future-conquest:r3-wp5-strategic-overlay';
const terrainGeoJSON = activeGeojson as unknown as Parameters<typeof buildTerrainPoliticalGeoJSON>[0];

interface StrategicPreferences {
  overlay: R3StrategicOverlay;
  resource: R3ResourceMetric;
}

type TerrainWindow = typeof window & { __r3TerrainMap?: Map };

function browserTerrainProfile(): TerrainPresentationProfile {
  if (typeof window === 'undefined') return 'full';
  return chooseTerrainPresentationProfile({
    viewportWidth: window.innerWidth,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches
  });
}

function strategicPreferences(): StrategicPreferences {
  const fallback: StrategicPreferences = { overlay: 'control', resource: 'food' };
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STRATEGIC_PREFERENCES_KEY) ?? '') as Partial<StrategicPreferences>;
    const overlay = R3_STRATEGIC_OVERLAY_OPTIONS.some(option => option.id === parsed.overlay) ? parsed.overlay : fallback.overlay;
    const resource = R3_RESOURCE_METRIC_OPTIONS.some(option => option.id === parsed.resource) ? parsed.resource : fallback.resource;
    return { overlay: overlay as R3StrategicOverlay, resource: resource as R3ResourceMetric };
  } catch {
    return fallback;
  }
}

export function TerrainMapPrototype(props: TerrainMapPrototypeProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<TerrainPresentationProfile>(browserTerrainProfile);
  const [preferences, setPreferences] = useState<StrategicPreferences>(strategicPreferences);
  const { reducedMotion, motionScale, colourBlindAssist } = useLiveGlobalSettings();
  const boardState = useBoardGameState();
  const boardProjection = useMemo(() => projectBoardStateForRenderer(boardState), [boardState]);
  const { onFallback, state } = props;
  const legend = useMemo(
    () => r3StrategicOverlayLegend(preferences.overlay, preferences.resource),
    [preferences]
  );
  const showResourceSelector = preferences.overlay === 'resources' || preferences.overlay === 'stockpiles';
  const effectiveMotionScale = reducedMotion ? 0 : motionScale;
  const motionDurationMs = Math.round(850 * effectiveMotionScale);
  const motionStyle = { '--r3-wp8-motion-duration': `${motionDurationMs}ms` } as CSSProperties;

  useEffect(() => {
    const refreshProfile = () => setProfile(browserTerrainProfile());
    window.addEventListener('resize', refreshProfile);
    return () => window.removeEventListener('resize', refreshProfile);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STRATEGIC_PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (profile === 'svg-fallback') return;
    let frame = 0;
    let attempts = 0;
    let disposed = false;

    const projectTokens = () => {
      if (disposed) return;
      const root = shellRef.current;
      if (!root) {
        if (attempts++ < 180) frame = window.requestAnimationFrame(projectTokens);
        return;
      }

      const evidence = applyBg12iBoardTokens(root, boardProjection);
      root.dataset.bg12iFormationTokens = String(evidence.formationMarkers);
      root.dataset.bg12iControlTokens = String(evidence.controlMarkers);
      if (evidence.formationMarkers === 0 && attempts++ < 180) {
        frame = window.requestAnimationFrame(projectTokens);
      }
    };

    frame = window.requestAnimationFrame(projectTokens);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
    };
  }, [profile, state, boardProjection]);

  useEffect(() => {
    if (profile === 'svg-fallback') {
      onFallback('Compact touch display selected the stable SVG command map.');
    }
  }, [profile, onFallback]);

  useEffect(() => {
    if (profile === 'svg-fallback') return;
    let frame = 0;
    let disposed = false;
    let dataSynchronised = false;
    const threats = getThreatenedTerritories(state);
    const activeCombatTerritoryIds = Object.values(state.operations).map(operation => operation.target);
    const projectedPoliticalData = buildTerrainPoliticalGeoJSON(terrainGeoJSON, state, {
      threatenedTerritories: threats,
      activeCombatTerritoryIds
    });
    const strategicData = enrichR3StrategicPoliticalGeoJSON(projectedPoliticalData, state) as unknown as GeoJSONSourceSpecification['data'];
    const strategicRouteData = buildTerrainStrategicRouteGeoJSON(
      STRATEGIC_NODES,
      STRATEGIC_ROUTES,
      state
    ) as unknown as GeoJSONSourceSpecification['data'];
    const strategicNodeData = enrichR3StrategicNodeGeoJSON(
      buildTerrainStrategicNodeGeoJSON(STRATEGIC_NODES, state),
      state
    ) as unknown as GeoJSONSourceSpecification['data'];

    const synchronise = () => {
      if (disposed) return;
      const map = (window as TerrainWindow).__r3TerrainMap;
      if (!map) {
        frame = window.requestAnimationFrame(synchronise);
        return;
      }
      const territorySource = map.getSource('campaign-territories');
      const routeSource = map.getSource('campaign-strategic-routes');
      const nodeSource = map.getSource('campaign-strategic-nodes');
      if (!(territorySource instanceof GeoJSONSource)
        || !(routeSource instanceof GeoJSONSource)
        || !(nodeSource instanceof GeoJSONSource)) {
        frame = window.requestAnimationFrame(synchronise);
        return;
      }

      if (!dataSynchronised) {
        // Source data can settle independently of DEM/WebGL tile readiness. Send
        // each authoritative snapshot once; repeatedly calling setData while the
        // style is settling would keep GeoJSON workers perpetually invalidated.
        territorySource.setData(strategicData);
        routeSource.setData(strategicRouteData);
        nodeSource.setData(strategicNodeData);
        dataSynchronised = true;
      }

      if (!applyR3StrategicInformationOverlay(map, preferences.overlay, preferences.resource)) {
        frame = window.requestAnimationFrame(synchronise);
      }
    };

    frame = window.requestAnimationFrame(synchronise);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
    };
  }, [profile, state, preferences]);

  const moveCamera = (id: TerrainCameraPreset['id'], forceImmediate = false) => {
    if (profile === 'svg-fallback') return false;
    const map = (window as TerrainWindow).__r3TerrainMap;
    if (!map) return false;
    const preset = terrainCameraPreset(id);
    const profiled = terrainCameraForProfile(preset, profile);
    const selectedCentre = state.selectedTerritory
      ? terrainOperationalTerritoryCentres[state.selectedTerritory]
      : undefined;
    const center = id === 'selected' && selectedCentre ? selectedCentre : profiled.center;
    const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({
      center: [center[0], center[1]],
      zoom: profiled.zoom,
      pitch: profiled.pitch,
      bearing: profiled.bearing,
      duration: forceImmediate || reducedMotion || systemReducedMotion ? 0 : motionDurationMs
    });
    return true;
  };

  const handleCameraClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('.r3-terrain-prototype-toolbar button');
    if (!(button instanceof HTMLButtonElement)) return;
    const id = button.textContent?.trim() as TerrainCameraPreset['id'] | undefined;
    if (!id || !['theatre', 'campaign', 'selected'].includes(id)) return;
    const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion && !systemReducedMotion && motionScale === 1) return;
    if (!moveCamera(id)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    if (moveCamera('theatre', true)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onFallback('Terrain camera recovery requested; using the stable SVG command map.');
  };

  if (profile === 'svg-fallback') {
    return <div className="r3-terrain-compact-fallback" role="status">Loading compact 2D command map…</div>;
  }

  return <div
    ref={shellRef}
    className="r3-terrain-prototype-shell"
    data-terrain-profile={profile}
    data-reduced-motion={reducedMotion ? 'true' : 'false'}
    data-motion-scale={effectiveMotionScale.toFixed(1)}
    data-colour-blind-assist={colourBlindAssist ? 'true' : 'false'}
    style={motionStyle}
    onClickCapture={handleCameraClickCapture}
    onKeyDownCapture={handleKeyDownCapture}
  >
    <button
      type="button"
      className="r3-terrain-use-svg"
      onClick={() => onFallback('Player selected the stable SVG command map.')}
    >
      2D accessible map
    </button>
    <TerrainMapPrototypeImpl key={profile} {...props} presentationProfile={profile} />
    <aside className="r3-strategic-information-control" aria-label="Strategic information layer">
      <label>
        <span>Strategic view</span>
        <select
          value={preferences.overlay}
          onChange={event => setPreferences(current => ({
            ...current,
            overlay: event.target.value as R3StrategicOverlay
          }))}
        >
          {R3_STRATEGIC_OVERLAY_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      {showResourceSelector && <label>
        <span>Resource</span>
        <select
          value={preferences.resource}
          onChange={event => setPreferences(current => ({
            ...current,
            resource: event.target.value as R3ResourceMetric
          }))}
        >
          {R3_RESOURCE_METRIC_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>}
      <div className="r3-strategic-information-legend" aria-live="polite">
        <strong>{legend.title}</strong>
        <span>{legend.detail}</span>
        {colourBlindAssist && <small>Colour-blind assist active: hostile, selected and warning markers use reinforced non-colour cues.</small>}
      </div>
    </aside>
  </div>;
}

export type { TerrainMapPrototypeProps };
export { prewarmTerrainRuntime };
