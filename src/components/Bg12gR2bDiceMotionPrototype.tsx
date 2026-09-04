import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DEFAULT_DICE_THEME, normaliseDiceTheme } from './bg12gDiceTheme';
import { clampD6Value, disposeThreeScene, makeD6 } from './bg12gDiceGeometry';
import {
  addDiceTrayLighting,
  applyDiceMotionPose,
  createDieMotion
} from './bg12gDiceMotion';
import '../bg12g-r2a-dice-prototype.css';
import '../bg12g-r2b-dice-motion.css';

type MotionState = 'ready' | 'rolling' | 'settled';

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
    addDiceTrayLighting(scene);

    const leftMotion = createDieMotion('left', left);
    const rightMotion = createDieMotion('right', right);
    applyDiceMotionPose(leftDie, leftMotion, 0);
    applyDiceMotionPose(rightDie, rightMotion, 0);

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
      applyDiceMotionPose(leftDie, leftMotion, 0);
      applyDiceMotionPose(rightDie, rightMotion, 0);
      window.dispatchEvent(new CustomEvent('future-conquest:bg12g-r2b-motion', {
        detail: { phase: 'start', dice: [left, right], total }
      }));

      const animate = (now: number) => {
        const elapsed = now - startedAt;
        const leftSettled = applyDiceMotionPose(leftDie, leftMotion, elapsed);
        const rightSettled = applyDiceMotionPose(rightDie, rightMotion, elapsed);
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
