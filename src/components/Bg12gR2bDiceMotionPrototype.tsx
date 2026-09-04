import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DEFAULT_DICE_THEME, normaliseDiceTheme } from './bg12gDiceTheme';
import {
  clampD6Value,
  disposeThreeScene,
  getFaceUpQuaternion,
  makeD6,
  type D6Value
} from './bg12gDiceGeometry';
import '../bg12g-r2a-dice-prototype.css';
import '../bg12g-r2b-dice-motion.css';

type MotionState = 'ready' | 'rolling' | 'settled';

type MotionKeyframe = {
  at: number;
  position: [number, number, number];
  spin: [number, number, number];
};

type DieMotion = {
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

function applyMotionPose(die: THREE.Group, motion: DieMotion, elapsedMs: number) {
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

function addTrayLighting(scene: THREE.Scene) {
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

export function Bg12gR2bDiceMotionPrototype({
  leftFace,
  rightFace,
  autoPlay = false
}: {
  leftFace: number;
  rightFace: number;
  autoPlay?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<() => void>(() => undefined);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [motionState, setMotionState] = useState<MotionState>('ready');
  const left = clampD6Value(leftFace);
  const right = clampD6Value(rightFace);
  const total = left + right;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const theme = normaliseDiceTheme(DEFAULT_DICE_THEME);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      setRendererError(null);
    } catch (error) {
      setRendererError(error instanceof Error ? error.message : 'Three.js renderer creation failed');
      return;
    }

    renderer.domElement.className = 'bg12g-r2a-canvas bg12g-r2b-canvas';
    renderer.domElement.dataset.bg12gR2bRenderer = 'three';
    renderer.domElement.dataset.leftFace = String(left);
    renderer.domElement.dataset.rightFace = String(right);
    renderer.domElement.dataset.total = String(total);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.tray.backgroundColour);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(5.4, 4.9, 7.25);
    camera.lookAt(0, 0.05, 0);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9.8, 6.8),
      new THREE.MeshStandardMaterial({
        color: theme.tray.floorColour,
        roughness: theme.tray.floorRoughness,
        metalness: theme.tray.floorMetalness
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.08;
    floor.receiveShadow = true;
    scene.add(floor);

    const leftDie = makeD6(theme, 'BG12G-R2B left D6');
    const rightDie = makeD6(theme, 'BG12G-R2B right D6');
    scene.add(leftDie, rightDie);
    addTrayLighting(scene);

    const leftMotion: DieMotion = { ...LEFT_MOTION, finalFace: left };
    const rightMotion: DieMotion = { ...RIGHT_MOTION, finalFace: right };
    applyMotionPose(leftDie, leftMotion, 0);
    applyMotionPose(rightDie, rightMotion, 0);

    let animationFrame = 0;
    let autoplayFrame = 0;
    let rolling = false;

    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const width = Math.max(host.clientWidth, 320);
      const height = Math.max(host.clientHeight, 260);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const startRoll = () => {
      if (rolling) return;
      rolling = true;
      setMotionState('rolling');
      const startedAt = performance.now();
      applyMotionPose(leftDie, leftMotion, 0);
      applyMotionPose(rightDie, rightMotion, 0);
      window.dispatchEvent(new CustomEvent('future-conquest:bg12g-r2b-motion', {
        detail: { phase: 'start', dice: [left, right], total }
      }));

      const animate = (now: number) => {
        const elapsed = now - startedAt;
        const leftSettled = applyMotionPose(leftDie, leftMotion, elapsed);
        const rightSettled = applyMotionPose(rightDie, rightMotion, elapsed);
        render();

        if (leftSettled && rightSettled) {
          rolling = false;
          setMotionState('settled');
          window.dispatchEvent(new CustomEvent('future-conquest:bg12g-r2b-motion', {
            detail: { phase: 'settled', dice: [left, right], total }
          }));
          return;
        }
        animationFrame = window.requestAnimationFrame(animate);
      };

      animationFrame = window.requestAnimationFrame(animate);
    };

    rollRef.current = startRoll;
    render();
    if (autoPlay) autoplayFrame = window.requestAnimationFrame(startRoll);

    return () => {
      rolling = false;
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(autoplayFrame);
      resizeObserver.disconnect();
      rollRef.current = () => undefined;
      disposeThreeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [autoPlay, left, right, total]);

  return <main
    className="bg12g-r2a-prototype bg12g-r2b-prototype"
    data-bg12g-r2b-prototype="true"
    data-motion-state={motionState}
    data-left-face={left}
    data-right-face={right}
    data-total={total}
    data-renderer={rendererError ? 'failed' : 'three'}
  >
    <section className="bg12g-r2a-card" aria-label={`BG12G-R2B two-D6 motion prototype landing on ${left} and ${right}`}>
      <header>
        <span>BG12G-R2B</span>
        <strong>Two-D6 throw, bounce and settle prototype</strong>
      </header>
      <div className="bg12g-r2a-tray bg12g-r2b-tray">
        <div className="bg12g-r2a-tray-rim" aria-hidden="true" />
        <div ref={hostRef} className="bg12g-r2a-render-host">
          {rendererError && <p className="bg12g-r2a-error">3D motion prototype unavailable: {rendererError}</p>}
        </div>
        <div className="bg12g-r2b-state" aria-live="polite">
          {motionState === 'rolling' ? 'Rolling…' : motionState === 'settled' ? `${left} + ${right} = ${total}` : 'Ready'}
        </div>
      </div>
      <footer className="bg12g-r2b-footer">
        <span>Predetermined landing</span>
        <b>{left} + {right}</b>
        <button type="button" onClick={() => rollRef.current()} disabled={motionState === 'rolling'}>
          {motionState === 'rolling' ? 'ROLLING' : 'THROW AGAIN'}
        </button>
        <span>Scripted physical theatre · no result RNG · exact face convergence</span>
      </footer>
    </section>
  </main>;
}
