import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DEFAULT_DICE_THEME, normaliseDiceTheme } from './bg12gDiceTheme';
import { clampD6Value, disposeThreeScene, makeD6 } from './bg12gDiceGeometry';
import {
  BG12G_REDUCED_ROLL_DURATION_MS,
  addDiceTrayLighting,
  applyDiceMotionPose,
  createDieMotion,
  setReducedMotionStartPose,
  setSettledDicePose
} from './bg12gDiceMotion';

type DicePair = [number, number];
type RendererState = 'ready' | 'rolling' | 'settled' | 'fallback';
type DiceRendererLifecycle = { created: number; disposed: number; active: number; peak: number };

const PREVIEW_DICE: DicePair = [3, 5];
const lifecycle: DiceRendererLifecycle = { created: 0, disposed: 0, active: 0, peak: 0 };

function publishLifecycle() {
  const target = window as Window & { __bg12gDiceRendererLifecycle?: DiceRendererLifecycle };
  target.__bg12gDiceRendererLifecycle = { ...lifecycle };
}

function markRendererCreated() {
  lifecycle.created += 1;
  lifecycle.active += 1;
  lifecycle.peak = Math.max(lifecycle.peak, lifecycle.active);
  publishLifecycle();
}

function markRendererDisposed() {
  lifecycle.disposed += 1;
  lifecycle.active = Math.max(0, lifecycle.active - 1);
  publishLifecycle();
}

function fallbackGlyph(value: number) {
  return ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value - 1] ?? String(value);
}

export function Bg12gIntegratedDiceRenderer({
  dice,
  animate = false,
  onSettled,
  onRendererFailure
}: {
  dice: DicePair | null;
  animate?: boolean;
  onSettled?: () => void;
  onRendererFailure?: (message: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const initialAnimateRef = useRef(animate);
  const settledCallbackRef = useRef(onSettled);
  const failureCallbackRef = useRef(onRendererFailure);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [rendererState, setRendererState] = useState<RendererState>('ready');
  const visibleDice = dice ?? PREVIEW_DICE;
  const left = clampD6Value(visibleDice[0]);
  const right = clampD6Value(visibleDice[1]);
  const total = left + right;
  const authoritative = dice !== null;

  useEffect(() => {
    settledCallbackRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    failureCallbackRef.current = onRendererFailure;
  }, [onRendererFailure]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shouldAnimate = initialAnimateRef.current && authoritative;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const forceFallback = new URLSearchParams(window.location.search).get('bg12g-force-dice-fallback') === '1';
    const theme = normaliseDiceTheme(DEFAULT_DICE_THEME);
    let animationFrame = 0;
    let reducedSettleTimer = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let settledNotified = false;
    let lifecycleRegistered = false;

    const notifySettled = () => {
      if (settledNotified) return;
      settledNotified = true;
      setRendererState('settled');
      settledCallbackRef.current?.();
    };

    try {
      if (forceFallback) throw new Error('Forced BG12G dice renderer fallback');
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      lifecycleRegistered = true;
      markRendererCreated();
      setRendererError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Three.js dice renderer creation failed';
      setRendererError(message);
      setRendererState('fallback');
      failureCallbackRef.current?.(message);
      if (shouldAnimate) window.queueMicrotask(notifySettled);
      return;
    }

    renderer.domElement.className = 'bg12g-integrated-dice-canvas';
    renderer.domElement.dataset.bg12gIntegratedDiceRenderer = 'three';
    renderer.domElement.dataset.dieCount = '2';
    renderer.domElement.dataset.leftFace = String(left);
    renderer.domElement.dataset.rightFace = String(right);
    renderer.domElement.dataset.total = String(total);
    renderer.domElement.dataset.authoritative = String(authoritative);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.replaceChildren(renderer.domElement);

    scene = new THREE.Scene();
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

    const leftDie = makeD6(theme, 'BG12G-R2C integrated left D6');
    const rightDie = makeD6(theme, 'BG12G-R2C integrated right D6');
    scene.add(leftDie, rightDie);
    addDiceTrayLighting(scene);

    const leftMotion = createDieMotion('left', left);
    const rightMotion = createDieMotion('right', right);

    const render = () => renderer?.render(scene!, camera);
    const resize = () => {
      if (!renderer) return;
      const width = Math.max(host.clientWidth, 160);
      const height = Math.max(host.clientHeight, 118);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    if (!shouldAnimate) {
      setSettledDicePose(leftDie, 'left', left);
      setSettledDicePose(rightDie, 'right', right);
      setRendererState(authoritative ? 'settled' : 'ready');
      resize();
    } else if (reducedMotion) {
      setRendererState('rolling');
      setReducedMotionStartPose(leftDie, 'left', left);
      setReducedMotionStartPose(rightDie, 'right', right);
      resize();
      reducedSettleTimer = window.setTimeout(() => {
        setSettledDicePose(leftDie, 'left', left);
        setSettledDicePose(rightDie, 'right', right);
        render();
        notifySettled();
      }, BG12G_REDUCED_ROLL_DURATION_MS);
    } else {
      setRendererState('rolling');
      applyDiceMotionPose(leftDie, leftMotion, 0);
      applyDiceMotionPose(rightDie, rightMotion, 0);
      resize();
      const startedAt = performance.now();

      const animateFrame = (now: number) => {
        const elapsed = now - startedAt;
        const leftSettled = applyDiceMotionPose(leftDie, leftMotion, elapsed);
        const rightSettled = applyDiceMotionPose(rightDie, rightMotion, elapsed);
        render();
        if (leftSettled && rightSettled) {
          notifySettled();
          return;
        }
        animationFrame = window.requestAnimationFrame(animateFrame);
      };

      animationFrame = window.requestAnimationFrame(animateFrame);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(reducedSettleTimer);
      resizeObserver?.disconnect();
      if (scene) disposeThreeScene(scene);
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
      if (lifecycleRegistered) markRendererDisposed();
    };
  }, [authoritative, left, right, total]);

  return <div
    className="bg12g-integrated-dice"
    data-renderer={rendererError ? 'fallback' : 'three'}
    data-motion-state={rendererState}
    data-authoritative={authoritative}
    data-die-count="2"
    data-left-face={authoritative ? left : undefined}
    data-right-face={authoritative ? right : undefined}
    data-total={authoritative ? total : undefined}
  >
    <div ref={hostRef} className="bg12g-integrated-dice-host" aria-hidden="true" />
    {authoritative && <div hidden data-bg12g-legacy-evidence-markers="true" aria-hidden="true">
      <span className="bg12g-d6-stage" data-authoritative-result={left} />
      <span className="bg12g-d6-stage" data-authoritative-result={right} />
    </div>}
    {rendererError && <div
      className="bg12g-dice-static-fallback"
      data-bg12g-dice-fallback="true"
      aria-hidden="true"
      title="3D dice renderer unavailable"
    >
      <span data-face={left}>{fallbackGlyph(left)}</span>
      <span data-face={right}>{fallbackGlyph(right)}</span>
    </div>}
  </div>;
}
