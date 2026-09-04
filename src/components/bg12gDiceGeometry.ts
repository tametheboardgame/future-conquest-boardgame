import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { DicePipTheme, DiceTheme } from './bg12gDiceTheme';

export const D6_VALUES = [1, 2, 3, 4, 5, 6] as const;
export type D6Value = (typeof D6_VALUES)[number];

const FACE_NORMALS: Record<D6Value, THREE.Vector3> = {
  1: new THREE.Vector3(0, 1, 0),
  2: new THREE.Vector3(0, 0, 1),
  3: new THREE.Vector3(1, 0, 0),
  4: new THREE.Vector3(-1, 0, 0),
  5: new THREE.Vector3(0, 0, -1),
  6: new THREE.Vector3(0, -1, 0)
};

const FACE_BASIS: Record<D6Value, { right: THREE.Vector3; up: THREE.Vector3 }> = {
  1: { right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, -1) },
  2: { right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
  3: { right: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
  4: { right: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
  5: { right: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
  6: { right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, 1) }
};

const PIP_LAYOUT: Record<D6Value, readonly [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, 1], [1, -1]],
  3: [[-1, 1], [0, 0], [1, -1]],
  4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
  5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
  6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]]
};

export function clampD6Value(value: number): D6Value {
  return Math.max(1, Math.min(6, Math.round(value))) as D6Value;
}

function makeMaterial(theme: {
  colour: number;
  roughness: number;
  metalness: number;
  emissive: number;
  emissiveIntensity: number;
}) {
  return new THREE.MeshStandardMaterial({
    color: theme.colour,
    roughness: theme.roughness,
    metalness: theme.metalness,
    emissive: theme.emissive,
    emissiveIntensity: theme.emissiveIntensity
  });
}

function addClassicRoundPips(
  group: THREE.Group,
  face: D6Value,
  material: THREE.MeshStandardMaterial,
  theme: DicePipTheme
) {
  const normal = FACE_NORMALS[face];
  const { right, up } = FACE_BASIS[face];
  const pipGeometry = new THREE.CylinderGeometry(theme.radius, theme.radius, theme.depth, 28);
  const faceRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal
  );

  for (const [column, row] of PIP_LAYOUT[face]) {
    const pip = new THREE.Mesh(pipGeometry, material);
    pip.quaternion.copy(faceRotation);
    pip.position
      .copy(normal)
      .multiplyScalar(theme.surfaceOffset)
      .addScaledVector(right, column * theme.spacing)
      .addScaledVector(up, row * theme.spacing);
    pip.castShadow = true;
    group.add(pip);
  }
}

type PipStyleRenderer = (
  group: THREE.Group,
  face: D6Value,
  material: THREE.MeshStandardMaterial,
  theme: DicePipTheme
) => void;

export const PIP_STYLE_RENDERERS: Record<string, PipStyleRenderer> = {
  'classic-round': addClassicRoundPips
};

function addFaceMarks(
  group: THREE.Group,
  face: D6Value,
  material: THREE.MeshStandardMaterial,
  theme: DicePipTheme
) {
  const renderer = PIP_STYLE_RENDERERS[theme.styleId] ?? PIP_STYLE_RENDERERS['classic-round'];
  renderer(group, face, material, theme);
}

export function makeD6(theme: DiceTheme, name = 'BG12G true-3D D6'): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  const dieMaterial = makeMaterial(theme.body);
  const pipMaterial = makeMaterial(theme.pips);
  const die = new THREE.Mesh(
    new RoundedBoxGeometry(2, 2, 2, theme.edge.bevelSegments, theme.edge.bevelRadius),
    dieMaterial
  );
  die.castShadow = true;
  die.receiveShadow = true;
  group.add(die);

  for (const face of D6_VALUES) addFaceMarks(group, face, pipMaterial, theme.pips);
  return group;
}

export function getFaceUpQuaternion(face: D6Value, twistDegrees = -24): THREE.Quaternion {
  const toUp = new THREE.Quaternion().setFromUnitVectors(
    FACE_NORMALS[face],
    new THREE.Vector3(0, 1, 0)
  );
  const tabletopTwist = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(twistDegrees)
  );
  return tabletopTwist.multiply(toUp);
}

export function orientFaceUp(die: THREE.Group, face: D6Value, twistDegrees = -24) {
  die.quaternion.copy(getFaceUpQuaternion(face, twistDegrees));
}

export function disposeThreeScene(scene: THREE.Scene) {
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}
