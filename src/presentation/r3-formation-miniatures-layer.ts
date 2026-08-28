import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map } from 'maplibre-gl';
import {
  AmbientLight,
  BoxGeometry,
  Camera,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type BufferGeometry
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GameState, TaskGroup } from '../game/types';
import { FORMATION_PRESENTATION_ANIMATION_MS, formationForwardPathTarget, formationPresentationPath, formationPresentationPosition, interpolateFormationPresentation, type FormationGeoPoint } from './r3-formation-movement';
import { terrainOperationalTerritoryCentres, type TerrainOperationalLayers } from './r3-terrain-operational-markers-core';

export const R3_FORMATION_MINIATURE_LAYER_ID = 'r3-wp3-5-formation-miniatures';
export const R3_FUTURE_SOLDIER_VISUAL_FAMILY = 'future-conquest-powered-armour';
export const R3_FUTURE_SOLDIER_REFERENCE = 'Future Conquest Armour Revision Sheet.png';
export const R3_FUTURE_SOLDIER_SIGNATURE_PARTS = [
  'powered-thighs',
  'powered-greaves',
  'modular-chest-plate',
  'shoulder-plates',
  'sealed-combat-helmet',
  'multispectral-visor',
  'power-pack',
  'carried-energy-rifle'
] as const;
const CLEARANCE_METRES = 45;
const VISUAL_GROUP_NAME = 'formation-miniature-visual';
const SOLDIER_GROUP_NAME = 'future-soldier-batches';
const SOLDIER_DETAIL_GROUP_NAME = 'future-soldier-detail-batches';
const SOLDIER_BATCH_COUNT = 7;
const ELEVATION_RESAMPLE_DEGREES = 0.01;
const FIGURE_OFFSETS = [[-0.5, -0.2], [0, 0.22], [0.5, -0.2], [-0.25, 0.55], [0.25, 0.55]] as const;

type MiniatureLod = 'theatre' | 'campaign' | 'local';
type Vec3 = readonly [number, number, number];

type Piece = {
  root: Group;
  current: FormationGeoPoint;
  from: FormationGeoPoint;
  target: FormationGeoPoint;
  startedAt: number;
  elevation?: number;
  elevationAt?: FormationGeoPoint;
};

export type FormationMiniatureBrowserEvidence = {
  layerId: string;
  visualFamily: typeof R3_FUTURE_SOLDIER_VISUAL_FAMILY;
  reducedMotion: boolean;
  motionScale: number;
  animationDurationMs: number;
  renderCount: number;
  presentationWithheld: boolean;
  pieces: Array<{
    id: string;
    current: FormationGeoPoint;
    target: FormationGeoPoint;
    elevation: number;
    visible: boolean;
    clusterOffset: readonly [number, number];
    displayScale: number;
    lod: MiniatureLod;
    visibleFigureCount: number;
    soldierDrawBatches: number;
  }>;
};

export type FormationPortalTargetEvidence = {
  pieces: Array<{
    id: string;
    target: FormationGeoPoint;
  }>;
};

declare global {
  interface Window {
    __r3FormationMiniatures?: FormationMiniatureBrowserEvidence;
    __r3FormationPortalTargets?: FormationPortalTargetEvidence;
  }
}

const statusColours: Record<TaskGroup['status'], number> = {
  ready: 0x65d8ca,
  moving: 0x8fe9dc,
  attacking: 0xff986e,
  garrison: 0xc6d875,
  recovering: 0x86a7b3,
  engineering: 0xe2bc63,
  interdicting: 0xc18ee8
};

type SoldierMaterials = {
  armour: MeshStandardMaterial;
  undersuit: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  weapon: MeshStandardMaterial;
  visor: MeshStandardMaterial;
};

function makeSoldierMaterials(group: TaskGroup, selected: boolean): SoldierMaterials {
  const statusColour = statusColours[group.status];
  return {
    armour: new MeshStandardMaterial({ color: 0x283238, roughness: 0.68, metalness: 0.32 }),
    undersuit: new MeshStandardMaterial({ color: 0x10171a, roughness: 0.9, metalness: 0.08 }),
    accent: new MeshStandardMaterial({ color: selected ? 0xeaff78 : statusColour, roughness: 0.55, metalness: 0.28 }),
    weapon: new MeshStandardMaterial({ color: 0x182328, roughness: 0.58, metalness: 0.5 }),
    visor: new MeshStandardMaterial({ color: selected ? 0xf5ffb0 : statusColour, roughness: 0.28, metalness: 0.42 })
  };
}

function transformGeometry(geometry: BufferGeometry, position: Vec3, rotation: Vec3 = [0, 0, 0], parent?: Matrix4) {
  const transform = new Object3D();
  transform.position.set(position[0], position[1], position[2]);
  transform.rotation.set(rotation[0], rotation[1], rotation[2]);
  transform.updateMatrix();
  geometry.applyMatrix4(parent ? parent.clone().multiply(transform.matrix) : transform.matrix);
  return geometry;
}

function boxGeometry(size: Vec3, position: Vec3, rotation: Vec3 = [0, 0, 0], parent?: Matrix4) {
  return transformGeometry(new BoxGeometry(size[0], size[1], size[2]), position, rotation, parent);
}

function verticalCylinderGeometry(topRadius: number, bottomRadius: number, height: number, position: Vec3, segments = 7) {
  return transformGeometry(new CylinderGeometry(topRadius, bottomRadius, height, segments), position, [Math.PI / 2, 0, 0]);
}

function mergeParts(parts: BufferGeometry[], label: string) {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error(`Unable to merge Future Conquest soldier geometry batch: ${label}`);
  merged.name = label;
  return merged;
}

function rifleParentMatrix(status: TaskGroup['status']) {
  const rifle = new Object3D();
  rifle.position.set(0.18, -0.04, 0.68);
  rifle.rotation.z = status === 'attacking' ? -0.03 : status === 'moving' ? -0.17 : -0.10;
  rifle.rotation.x = status === 'recovering' ? -0.08 : 0.03;
  rifle.updateMatrix();
  return rifle.matrix.clone();
}

function makeSoldierBatchGeometries(status: TaskGroup['status']) {
  const rifleMatrix = rifleParentMatrix(status);
  return {
    coreArmour: mergeParts([
      boxGeometry([0.12, 0.14, 0.25], [-0.09, 0, 0.36]),
      boxGeometry([0.12, 0.14, 0.25], [0.09, 0, 0.36]),
      boxGeometry([0.14, 0.15, 0.24], [-0.09, 0, 0.10]),
      boxGeometry([0.14, 0.15, 0.24], [0.09, 0, 0.10]),
      boxGeometry([0.38, 0.22, 0.26], [0, -0.015, 0.72]),
      boxGeometry([0.19, 0.20, 0.13], [-0.25, 0, 0.80]),
      boxGeometry([0.19, 0.20, 0.13], [0.25, 0, 0.80]),
      verticalCylinderGeometry(0.14, 0.15, 0.20, [0, 0, 1.02], 8),
      transformGeometry(new ConeGeometry(0.14, 0.09, 8), [0, 0, 1.16], [Math.PI / 2, 0, 0])
    ], 'future-soldier-core-armour'),
    coreUndersuit: mergeParts([
      boxGeometry([0.09, 0.10, 0.09], [-0.09, 0, 0.22]),
      boxGeometry([0.09, 0.10, 0.09], [0.09, 0, 0.22]),
      boxGeometry([0.15, 0.20, 0.08], [-0.09, -0.025, -0.03]),
      boxGeometry([0.15, 0.20, 0.08], [0.09, -0.025, -0.03]),
      verticalCylinderGeometry(0.15, 0.17, 0.18, [0, 0, 0.51], 6),
      verticalCylinderGeometry(0.17, 0.20, 0.34, [0, 0, 0.69], 7),
      verticalCylinderGeometry(0.10, 0.11, 0.09, [0, 0, 0.91], 7)
    ], 'future-soldier-core-undersuit'),
    coreAccent: mergeParts([
      boxGeometry([0.18, 0.014, 0.05], [0, -0.133, 0.73])
    ], 'future-soldier-core-accent'),
    coreWeapon: mergeParts([
      boxGeometry([0.26, 0.14, 0.30], [0, 0.17, 0.71]),
      boxGeometry([0.10, 0.43, 0.10], [0, -0.05, 0], [0, 0, 0], rifleMatrix),
      boxGeometry([0.055, 0.28, 0.055], [0, -0.37, 0.015], [0, 0, 0], rifleMatrix),
      boxGeometry([0.12, 0.16, 0.11], [0, 0.23, 0], [0, 0, 0], rifleMatrix)
    ], 'carried-energy-rifle-and-power-pack'),
    coreVisor: mergeParts([
      boxGeometry([0.22, 0.025, 0.055], [0, -0.13, 1.04])
    ], 'multispectral-visor'),
    detailArmour: mergeParts([
      boxGeometry([0.10, 0.12, 0.24], [-0.25, -0.015, 0.62]),
      boxGeometry([0.10, 0.12, 0.24], [0.25, -0.015, 0.62])
    ], 'future-soldier-detail-armour'),
    detailAccent: mergeParts([
      boxGeometry([0.15, 0.04, 0.09], [-0.09, -0.085, 0.22]),
      boxGeometry([0.15, 0.04, 0.09], [0.09, -0.085, 0.22]),
      boxGeometry([0.08, 0.10, 0.24], [-0.12, 0.20, 0.72]),
      boxGeometry([0.08, 0.10, 0.24], [0.12, 0.20, 0.72]),
      boxGeometry([0.12, 0.10, 0.12], [0.07, -0.02, -0.075], [0, 0, 0], rifleMatrix)
    ], 'future-soldier-detail-accent')
  };
}

function setFigureInstances(mesh: InstancedMesh, status: TaskGroup['status']) {
  const transform = new Object3D();
  FIGURE_OFFSETS.forEach(([x, y], index) => {
    transform.position.set(x, y, 0.06);
    transform.rotation.set(
      status === 'moving' ? 0.08 : status === 'attacking' ? 0.035 : status === 'recovering' ? -0.025 : 0,
      0,
      (index - 2) * 0.025
    );
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function makeSoldierBatches(materials: SoldierMaterials, status: TaskGroup['status']) {
  const geometries = makeSoldierBatchGeometries(status);
  const soldier = new Group();
  soldier.name = SOLDIER_GROUP_NAME;
  const detail = new Group();
  detail.name = SOLDIER_DETAIL_GROUP_NAME;

  const definitions: Array<[BufferGeometry, MeshStandardMaterial, Group]> = [
    [geometries.coreArmour, materials.armour, soldier],
    [geometries.coreUndersuit, materials.undersuit, soldier],
    [geometries.coreAccent, materials.accent, soldier],
    [geometries.coreWeapon, materials.weapon, soldier],
    [geometries.coreVisor, materials.visor, soldier],
    [geometries.detailArmour, materials.armour, detail],
    [geometries.detailAccent, materials.accent, detail]
  ];

  for (const [geometry, material, parent] of definitions) {
    const batch = new InstancedMesh(geometry, material, FIGURE_OFFSETS.length);
    batch.name = geometry.name;
    batch.userData.futureSoldierBatch = true;
    setFigureInstances(batch, status);
    parent.add(batch);
  }
  soldier.add(detail);
  soldier.userData.drawBatchCount = SOLDIER_BATCH_COUNT;
  return soldier;
}

function makeIdentityTexture(group: TaskGroup) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#102b32';
  context.fillRect(0, 0, 128, 48);
  context.strokeStyle = '#a8fff4';
  context.lineWidth = 3;
  context.strokeRect(2, 2, 124, 44);
  context.fillStyle = '#effffd';
  context.font = 'bold 25px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`TG ${group.id.replace('TG-', '')}`, 64, 25);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function makeMiniature(group: TaskGroup, selected: boolean) {
  const root = new Group();
  const visual = new Group();
  visual.name = VISUAL_GROUP_NAME;
  const materials = makeSoldierMaterials(group, selected);
  const base = new Mesh(
    new CylinderGeometry(selected ? 1.25 : 1.08, selected ? 1.35 : 1.18, 0.16, 16),
    new MeshStandardMaterial({ color: 0x15292d, roughness: 0.86, metalness: 0.12 })
  );
  base.name = 'formation-plinth';
  base.rotation.x = Math.PI / 2;
  base.position.z = 0.08;
  const statusRing = new Mesh(
    new CylinderGeometry(selected ? 1.10 : 0.96, selected ? 1.18 : 1.04, 0.035, 16),
    materials.accent
  );
  statusRing.name = 'formation-status-ring';
  statusRing.rotation.x = Math.PI / 2;
  statusRing.position.z = 0.175;
  visual.add(base, statusRing, makeSoldierBatches(materials, group.status));
  const label = new Mesh(
    new PlaneGeometry(1.55, 0.58),
    new MeshStandardMaterial({ map: makeIdentityTexture(group), transparent: true, side: DoubleSide, roughness: 0.8 })
  );
  label.name = 'formation-identity-plate';
  label.position.set(0, -0.88, 0.48);
  label.rotation.x = Math.PI / 2.7;
  visual.add(label);
  root.add(visual);
  root.userData.status = group.status;
  root.userData.visualFamily = R3_FUTURE_SOLDIER_VISUAL_FAMILY;
  root.userData.selected = selected;
  return root;
}

function movementBearing(group: TaskGroup) {
  const path = formationPresentationPath(group, terrainOperationalTerritoryCentres);
  if (!path || path.length < 2 || group.status !== 'moving') return 0;
  const progress = group.order?.type === 'move' ? group.order.progress / 100 : 0;
  const position = formationPresentationPosition(group, terrainOperationalTerritoryCentres) ?? path[0];
  const next = formationForwardPathTarget(path, progress) ?? path.at(-1)!;
  return Math.atan2(next[0] - position[0], next[1] - position[1]);
}

function disposeMiniature(root: Object3D) {
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<MeshStandardMaterial>();
  root.traverse(child => {
    if (!(child instanceof Mesh)) return;
    geometries.add(child.geometry);
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of meshMaterials) if (material instanceof MeshStandardMaterial) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) { material.map?.dispose(); material.dispose(); }
}

function coordinateKey(point: FormationGeoPoint) {
  return `${point[0].toFixed(5)}:${point[1].toFixed(5)}`;
}

function sameFormationPoint(left: FormationGeoPoint, right: FormationGeoPoint) {
  return left[0] === right[0] && left[1] === right[1];
}

function clusterOffsets(state: GameState) {
  const clusters = new globalThis.Map<string, Array<{ id: string; point: FormationGeoPoint }>>();
  for (const group of Object.values(state.taskGroups)) {
    const point = formationPresentationPosition(group, terrainOperationalTerritoryCentres);
    if (!point) continue;
    const key = coordinateKey(point);
    const cluster = clusters.get(key) ?? [];
    cluster.push({ id: group.id, point });
    clusters.set(key, cluster);
  }

  const offsets = new globalThis.Map<string, readonly [number, number]>();
  for (const cluster of clusters.values()) {
    cluster.sort((a, b) => a.id.localeCompare(b.id));
    if (cluster.length === 1) {
      offsets.set(cluster[0].id, [0, 0]);
      continue;
    }
    const radius = cluster.length <= 4 ? 1.18 : 1.45;
    cluster.forEach((member, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / cluster.length;
      offsets.set(member.id, [Math.cos(angle) * radius, Math.sin(angle) * radius]);
    });
  }
  return offsets;
}

function presentationScaleForZoom(zoom: number) {
  if (zoom < 4.8) return 44_000;
  if (zoom < 6.4) return 28_000;
  return 18_000;
}

function miniatureLodForZoom(zoom: number): MiniatureLod {
  if (zoom < 4.8) return 'theatre';
  if (zoom < 6.4) return 'campaign';
  return 'local';
}

function applyMiniatureLod(root: Group, lod: MiniatureLod) {
  const selected = Boolean(root.userData.selected);
  const figureLimit = selected ? 5 : lod === 'theatre' ? 3 : lod === 'campaign' ? 4 : 5;
  const soldier = root.getObjectByName(SOLDIER_GROUP_NAME);
  soldier?.traverse(child => {
    if (child instanceof InstancedMesh && child.userData.futureSoldierBatch) child.count = figureLimit;
  });
  const detail = root.getObjectByName(SOLDIER_DETAIL_GROUP_NAME);
  if (detail) detail.visible = selected || lod === 'local';
  root.userData.lod = lod;
  root.userData.visibleFigureCount = figureLimit;
  return figureLimit;
}

function needsElevationSample(piece: Piece, point: FormationGeoPoint) {
  if (piece.elevation === undefined || !piece.elevationAt) return true;
  return Math.abs(piece.elevationAt[0] - point[0]) >= ELEVATION_RESAMPLE_DEGREES
    || Math.abs(piece.elevationAt[1] - point[1]) >= ELEVATION_RESAMPLE_DEGREES;
}

/** Derived-only Three.js presentation. MapLibre's matrix and DEM remain the sole camera/terrain authority. */
export class FormationMiniaturesLayer implements CustomLayerInterface {
  readonly id = R3_FORMATION_MINIATURE_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  private map?: Map;
  private renderer?: WebGLRenderer;
  private readonly camera = new Camera();
  private readonly scene = new Scene();
  private readonly pieces = new globalThis.Map<string, Piece>();
  private state: GameState;
  private reducedMotion = false;
  private motionScale = 1;
  private visible: boolean;
  private renderCount = 0;
  private rendererFailed = false;
  private clusterOffsetById = new globalThis.Map<string, readonly [number, number]>();

  constructor(state: GameState, layers: Pick<TerrainOperationalLayers, 'friendlyFormations'>) {
    this.state = state;
    this.visible = layers.friendlyFormations;
  }

  onAdd(map: Map, gl: WebGL2RenderingContext) {
    this.map = map;
    this.rendererFailed = false;
    this.renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.scene.add(new AmbientLight(0xd9f6ee, 1.5));
    const sun = new DirectionalLight(0xfff2d4, 2.4);
    sun.position.set(-3, -4, 8);
    this.scene.add(sun);
    this.rebuild();
    map.triggerRepaint();
  }

  update(state: GameState, layers: Pick<TerrainOperationalLayers, 'friendlyFormations'>) {
    this.state = state;
    this.visible = layers.friendlyFormations;
    this.rebuild();
    this.map?.triggerRepaint();
  }

  private syncMotionPreferences() {
    const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shell = this.map?.getContainer().closest<HTMLElement>('.r3-terrain-prototype-shell');
    const appReducedMotion = shell?.dataset.reducedMotion === 'true';
    const rawMotionScale = Number(shell?.dataset.motionScale ?? '1');
    this.motionScale = Number.isFinite(rawMotionScale) && rawMotionScale >= 0 ? rawMotionScale : 1;
    this.reducedMotion = systemReducedMotion || appReducedMotion || this.motionScale === 0;
  }

  private publishPortalTargets() {
    window.__r3FormationPortalTargets = {
      pieces: [...this.pieces.entries()].map(([id, piece]) => ({ id, target: [...piece.target] }))
    };
  }

  private rebuild() {
    if (!this.map) return;
    this.clusterOffsetById = clusterOffsets(this.state);
    const active = new Set(Object.keys(this.state.taskGroups));
    for (const [id, piece] of this.pieces) if (!active.has(id)) {
      this.scene.remove(piece.root);
      disposeMiniature(piece.root);
      this.pieces.delete(id);
    }
    for (const group of Object.values(this.state.taskGroups)) {
      const target = formationPresentationPosition(group, terrainOperationalTerritoryCentres);
      if (!target) continue;
      const selected = group.id === this.state.selectedTaskGroupId;
      const old = this.pieces.get(group.id);
      const targetChanged = Boolean(old && !sameFormationPoint(old.target, target));
      if (!old || old.root.userData.status !== group.status || Boolean(old.root.userData.selected) !== selected) {
        if (old) { this.scene.remove(old.root); disposeMiniature(old.root); }
        const root = makeMiniature(group, selected);
        root.rotation.z = movementBearing(group);
        this.scene.add(root);
        const current = old?.current ?? target;
        const now = performance.now();
        this.pieces.set(group.id, {
          root,
          current,
          from: targetChanged ? current : old?.from ?? current,
          target,
          startedAt: targetChanged ? now : old?.startedAt ?? now,
          elevation: old?.elevation,
          elevationAt: old?.elevationAt
        });
      } else {
        if (targetChanged) {
          old.from = old.current; old.target = target; old.startedAt = performance.now();
        }
        old.root.rotation.z = movementBearing(group);
      }
      const piece = this.pieces.get(group.id);
      const visual = piece?.root.getObjectByName(VISUAL_GROUP_NAME);
      const offset = this.clusterOffsetById.get(group.id) ?? [0, 0];
      visual?.position.set(offset[0], offset[1], 0);
    }
    this.publishPortalTargets();
  }

  render(_gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    if (this.rendererFailed) return;
    try {
      this.renderFrame(options);
    } catch (error) {
      this.rendererFailed = true;
      const host = this.map?.getContainer().parentElement;
      if (host) host.dataset.physicalFormations = 'fallback';
      console.warn('R3 physical formation renderer failed at runtime; retaining compatible markers.', error);
      this.renderer?.dispose();
      this.renderer = undefined;
      this.map?.triggerRepaint();
    }
  }

  private renderFrame(options: CustomRenderMethodInput) {
    if (!this.map || !this.renderer) return;
    this.syncMotionPreferences();
    const now = performance.now();
    let animating = false;
    const zoom = this.map.getZoom();
    const displayScale = presentationScaleForZoom(zoom);
    const lod = miniatureLodForZoom(zoom);
    const presentationWithheld = document.documentElement.dataset.r3WithholdFormations === 'true';
    const browserPieces: FormationMiniatureBrowserEvidence['pieces'] = [];
    for (const [id, piece] of this.pieces) {
      const elapsed = now - piece.startedAt;
      const travelling = !sameFormationPoint(piece.from, piece.target);
      const scaledElapsed = this.reducedMotion || this.motionScale === 0 ? FORMATION_PRESENTATION_ANIMATION_MS : elapsed / this.motionScale;
      piece.current = this.reducedMotion ? piece.target : interpolateFormationPresentation(piece.from, piece.target, scaledElapsed);
      animating ||= !this.reducedMotion && travelling && scaledElapsed < FORMATION_PRESENTATION_ANIMATION_MS;
      const lngLat: [number, number] = [piece.current[0], piece.current[1]];
      if (needsElevationSample(piece, lngLat)) {
        const sampledElevation = this.map.queryTerrainElevation(lngLat);
        if (sampledElevation !== null) {
          piece.elevation = sampledElevation;
          piece.elevationAt = [...lngLat];
        }
      }
      const elevation = piece.elevation ?? 0;
      const coordinate = MercatorCoordinate.fromLngLat(lngLat, elevation + CLEARANCE_METRES);
      const metres = coordinate.meterInMercatorCoordinateUnits();
      piece.root.position.set(coordinate.x, coordinate.y, coordinate.z);
      piece.root.scale.set(metres * displayScale, -metres * displayScale, metres * displayScale);
      piece.root.visible = this.visible && !presentationWithheld;
      const visibleFigureCount = applyMiniatureLod(piece.root, lod);
      browserPieces.push({
        id,
        current: [...piece.current],
        target: [...piece.target],
        elevation,
        visible: piece.root.visible,
        clusterOffset: this.clusterOffsetById.get(id) ?? [0, 0],
        displayScale,
        lod,
        visibleFigureCount,
        soldierDrawBatches: SOLDIER_BATCH_COUNT
      });
    }
    this.camera.projectionMatrix = new Matrix4().fromArray(options.defaultProjectionData.mainMatrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderCount += 1;
    window.__r3FormationMiniatures = {
      layerId: this.id,
      visualFamily: R3_FUTURE_SOLDIER_VISUAL_FAMILY,
      reducedMotion: this.reducedMotion,
      motionScale: this.motionScale,
      animationDurationMs: this.reducedMotion ? 0 : FORMATION_PRESENTATION_ANIMATION_MS * this.motionScale,
      renderCount: this.renderCount,
      presentationWithheld,
      pieces: browserPieces
    };
    if (animating) this.map.triggerRepaint();
  }

  onRemove() {
    this.renderer?.dispose();
    this.renderer = undefined;
    this.map = undefined;
    for (const piece of this.pieces.values()) disposeMiniature(piece.root);
    this.pieces.clear();
    this.scene.clear();
    this.clusterOffsetById.clear();
    this.reducedMotion = false;
    this.motionScale = 1;
    this.renderCount = 0;
    this.rendererFailed = false;
    delete window.__r3FormationMiniatures;
    delete window.__r3FormationPortalTargets;
  }
}