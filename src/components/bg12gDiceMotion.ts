import * as THREE from 'three';
import { getFaceUpQuaternion, type D6Value } from './bg12gDiceGeometry';

export type DieSide = 'left' | 'right';

type MotionKeyframe = {
  at: number;
  position: [number, number, number];
  spin: [number, number, number];
};

export type DieMotion = {
  delayMs: number;
  durationMs: number;
  finalFace: D6Value;
  finalTwist: number;
  keyframes: MotionKeyframe[];
};

const LEFT_MOTION: Omit<DieMotion, 'finalFace'> = {
  delayMs: 0,
  durationMs: 1580,
  finalTwist: -31,
  keyframes: [
    { at: 0, position: [-3.2, 1.25, 0.75], spin: [72, -96, 38] },
    { at: 0.18, position: [-2.45, 2.0, 0.38], spin: [172, -18, 126] },
    { at: 0.43, position: [-1.82, 0.02, 0.1], spin: [286, 94, 218] },
    { at: 0.57, position: [-1.58, 0.64, 0.02], spin: [334, 148, 278] },
    { at: 0.73, position: [-1.4, 0.01, -0.03], spin: [382, 206, 326] },
    { at: 0.84, position: [-1.31, 0.27, -0.04], spin: [398, 229, 346] },
    { at: 1, position: [-1.24, 0, -0.05], spin: [360, 360, 360] }
  ]
};

const RIGHT_MOTION: Omit<DieMotion, 'finalFace'> = {
  delayMs: 85,
  durationMs: 1660,
  finalTwist: 19,
  keyframes: [
    { at: 0, position: [3.15, 1.48, -0.52], spin: [-58, 108, -42] },
    { at: 0.2, position: [2.55, 2.16, -0.16], spin: [-156, 24, -134] },
    { at: 0.46, position: [1.94, 0.02, 0.08], spin: [-274, -88, -224] },
    { at: 0.61, position: [1.67, 0.56, 0.13], spin: [-326, -142, -276] },
    { at: 0.77, position: [1.48, 0.01, 0.16], spin: [-372, -201, -324] },
    { at: 0.88, position: [1.39, 0.22, 0.18], spin: [-394, -226, -342] },
    { at: 1, position: [1.33, 0, 0.2], spin: [-360, -360, -360] }
  ]
};

export const BG12G_FULL_ROLL_DURATION_MS = RIGHT_MOTION.delayMs + RIGHT_MOTION.durationMs;
export const BG12G_REDUCED_ROLL_DURATION_MS = 120;

function degreesToQuaternion(spin: [number, number, number], final: THREE.Quaternion) {
  const spinQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(spin[0]),
    THREE.MathUtils.degToRad(spin[1]),
    THREE.MathUtils.degToRad(spin[2]),
    'XYZ'
  ));
  return spinQuaternion.multiply(final);
}

function smoother(value: number) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

export function createDieMotion(side: DieSide, finalFace: D6Value): DieMotion {
  const template = side === 'left' ? LEFT_MOTION : RIGHT_MOTION;
  return { ...template, finalFace };
}

export function applyDiceMotionPose(die: THREE.Group, motion: DieMotion, elapsedMs: number) {
  const progress = THREE.MathUtils.clamp(
    (elapsedMs - motion.delayMs) / motion.durationMs,
    0,
    1
  );
  const frames = motion.keyframes;
  let from = frames[0];
  let to = frames[frames.length - 1];

  for (let index = 0; index < frames.length - 1; index += 1) {
    if (progress <= frames[index + 1].at) {
      from = frames[index];
      to = frames[index + 1];
      break;
    }
  }

  const segmentLength = Math.max(to.at - from.at, 0.0001);
  const segmentProgress = smoother((progress - from.at) / segmentLength);
  const fromPosition = new THREE.Vector3(...from.position);
  const toPosition = new THREE.Vector3(...to.position);
  die.position.lerpVectors(fromPosition, toPosition, segmentProgress);

  const finalQuaternion = getFaceUpQuaternion(motion.finalFace, motion.finalTwist);
  const fromQuaternion = degreesToQuaternion(from.spin, finalQuaternion.clone());
  const toQuaternion = degreesToQuaternion(to.spin, finalQuaternion.clone());
  die.quaternion.slerpQuaternions(fromQuaternion, toQuaternion, segmentProgress);

  if (progress >= 1) {
    die.position.set(...frames[frames.length - 1].position);
    die.quaternion.copy(finalQuaternion);
  }

  return progress >= 1;
}

export function setSettledDicePose(die: THREE.Group, side: DieSide, face: D6Value) {
  const motion = createDieMotion(side, face);
  const finalFrame = motion.keyframes[motion.keyframes.length - 1];
  die.position.set(...finalFrame.position);
  die.quaternion.copy(getFaceUpQuaternion(face, motion.finalTwist));
}

export function setReducedMotionStartPose(die: THREE.Group, side: DieSide, face: D6Value) {
  setSettledDicePose(die, side, face);
  die.position.y += 0.22;
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(side === 'left' ? 5 : -4),
    THREE.MathUtils.degToRad(side === 'left' ? -7 : 6),
    THREE.MathUtils.degToRad(side === 'left' ? -3 : 4)
  ));
  die.quaternion.premultiply(tilt);
}

export function addDiceTrayLighting(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x291922, 1.35));

  const key = new THREE.DirectionalLight(0xffe6c8, 3.4);
  key.position.set(3.8, 6.2, 4.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.00035;
  scene.add(key);

  const fill = new THREE.PointLight(0x9ab7d7, 7, 12, 2);
  fill.position.set(-4.5, 2.4, 2.4);
  scene.add(fill);

  const rim = new THREE.PointLight(0xd08965, 5.2, 11, 2);
  rim.position.set(1.4, 1.5, -4.6);
  scene.add(rim);
}
