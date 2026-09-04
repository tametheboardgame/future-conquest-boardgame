import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  DEFAULT_DICE_THEME,
  normaliseDiceTheme,
  type DicePipTheme,
  type DiceTheme
} from './bg12gDiceTheme';
import '../bg12g-r2a-dice-prototype.css';

const D6_VALUES = [1, 2, 3, 4, 5, 6] as const;
type D6Value = (typeof D6_VALUES)[number];

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

function clampFace(value: number): D6Value {
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

const PIP_STYLE_RENDERERS: Record<string, PipStyleRenderer> = {
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

function makeDie(theme: DiceTheme): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BG12G-R2A static D6';

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

function orientFaceUp(die: THREE.Group, face: D6Value) {
  const toUp = new THREE.Quaternion().setFromUnitVectors(
    FACE_NORMALS[face],
    new THREE.Vector3(0, 1, 0)
  );
  const tabletopTwist = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(-24)
  );
  die.quaternion.copy(tabletopTwist.multiply(toUp));
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

export function Bg12gR2aDicePrototype({
  face,
  theme = DEFAULT_DICE_THEME
}: {
  face: number;
  theme?: DiceTheme;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const faceUp = clampFace(face);

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

    const die = makeDie(safeTheme);
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
      disposeScene(scene);
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
