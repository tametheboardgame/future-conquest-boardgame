import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DEFAULT_DICE_THEME, normaliseDiceTheme, type DiceTheme } from './bg12gDiceTheme';
import {
  clampD6Value,
  disposeThreeScene,
  makeD6,
  orientFaceUp
} from './bg12gDiceGeometry';
import '../bg12g-r2a-dice-prototype.css';

export function Bg12gR2aDicePrototype({
  face,
  theme = DEFAULT_DICE_THEME
}: {
  face: number;
  theme?: DiceTheme;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const faceUp = clampD6Value(face);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const safeTheme = normaliseDiceTheme(theme);
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

    renderer.domElement.className = 'bg12g-r2a-canvas';
    renderer.domElement.dataset.bg12gR2aRenderer = 'three';
    renderer.domElement.dataset.faceUp = String(faceUp);
    renderer.domElement.dataset.diceTheme = safeTheme.id;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(safeTheme.tray.backgroundColour);

    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(4.8, 4.25, 5.8);
    camera.lookAt(0, -0.05, 0);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 6.2),
      new THREE.MeshStandardMaterial({
        color: safeTheme.tray.floorColour,
        roughness: safeTheme.tray.floorRoughness,
        metalness: safeTheme.tray.floorMetalness
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.08;
    floor.receiveShadow = true;
    scene.add(floor);

    const die = makeD6(safeTheme, 'BG12G-R2A static D6');
    die.position.set(0, 0, 0);
    orientFaceUp(die, faceUp);
    scene.add(die);

    const ambient = new THREE.HemisphereLight(0xfff0dc, 0x291922, 1.35);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffe6c8, 3.4);
    key.position.set(3.8, 6.2, 4.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.00035;
    scene.add(key);

    const fill = new THREE.PointLight(0x9ab7d7, 7, 12, 2);
    fill.position.set(-4.5, 2.4, 2.4);
    scene.add(fill);

    const rim = new THREE.PointLight(0xd08965, 5.2, 11, 2);
    rim.position.set(1.4, 1.5, -4.6);
    scene.add(rim);

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
    const settleFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(settleFrame);
      resizeObserver.disconnect();
      disposeThreeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [faceUp, theme]);

  return <main
    className="bg12g-r2a-prototype"
    data-bg12g-r2a-prototype="true"
    data-face-up={faceUp}
    data-dice-theme={theme.id}
    data-renderer={rendererError ? 'failed' : 'three'}
  >
    <section className="bg12g-r2a-card" aria-label={`BG12G-R2A static D6 prototype showing face ${faceUp} upward`}>
      <header>
        <span>BG12G-R2A.5</span>
        <strong>Static true-3D D6 prototype</strong>
      </header>
      <div className="bg12g-r2a-tray">
        <div className="bg12g-r2a-tray-rim" aria-hidden="true" />
        <div ref={hostRef} className="bg12g-r2a-render-host">
          {rendererError && <p className="bg12g-r2a-error">3D prototype unavailable: {rendererError}</p>}
        </div>
      </div>
      <footer>
        <span>Face up</span>
        <b>{faceUp}</b>
        <span>Bevelled cube · physical pips · real lighting · contact shadow</span>
      </footer>
    </section>
  </main>;
}
