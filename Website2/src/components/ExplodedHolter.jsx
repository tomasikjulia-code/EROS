import { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function CameraLight() {
  const lightRef = useRef();
  const { camera } = useThree();
  useFrame(() => {
    if (lightRef.current) lightRef.current.position.copy(camera.position);
  });
  return <pointLight ref={lightRef} intensity={5} decay={0} />;
}

// Fazy animacji (wartości progresu 0→1):
// 0.00 – 0.45 : model prosto do kamery (rotacja startowa)
// 0.35 – 0.65 : obrót do kąta docelowego
// 0.55 – 1.00 : rozstrzelenie elementów

const ROT_START = { x: 0,              y: 0 };
const ROT_END   = { x: -Math.PI / 3.2, y: Math.PI / 4 };

function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }
function easeOut3(t)  { return 1 - Math.pow(1 - t, 3); }
function phase(p, a, b) { return Math.max(0, Math.min(1, (p - a) / (b - a))); }

function ExplodedModel({ url, scale, explode }) {
  const { scene: rawScene } = useGLTF(url);
  const scene = useMemo(() => rawScene.clone(true), [rawScene]);

  const groupRef   = useRef();
  const meshInfoRef = useRef(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const items = [];
    scene.traverse(obj => {
      if (!obj.isMesh) return;
      obj.geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      obj.geometry.boundingBox.getCenter(center);
      items.push({ mesh: obj, centerZ: center.z });
    });
    items.sort((a, b) => a.centerZ - b.centerZ);
    const seen = new Set();
    meshInfoRef.current = items.filter(({ mesh }) => {
      if (seen.has(mesh.uuid)) return false;
      seen.add(mesh.uuid);
      return true;
    });
  }, [scene]);

  useFrame(() => {
    const items = meshInfoRef.current;
    if (!items?.length || !groupRef.current) return;

    const target = explode ? 1 : 0;
    const diff   = target - progressRef.current;
    progressRef.current = Math.abs(diff) < 0.001 ? target : progressRef.current + diff * 0.009;
    const p = progressRef.current;

    // — faza 1→2: obrót grupy
    const rotT = easeInOut(phase(p, 0.35, 0.65));
    groupRef.current.rotation.x = ROT_START.x + (ROT_END.x - ROT_START.x) * rotT;
    groupRef.current.rotation.y = ROT_START.y + (ROT_END.y - ROT_START.y) * rotT;

    // — faza 2→3: rozstrzelenie
    const n     = items.length;
    const meanZ = items.reduce((s, m) => s + m.centerZ, 0) / n;
    const SPREAD   = 3.0;
    const STAGGER  = 0.4;

    items.forEach(({ mesh, centerZ }, i) => {
      const delay = n > 1 ? (i / (n - 1)) * STAGGER : 0;
      const t = easeOut3(phase(p, 0.55 + delay * 0.2, 1.0));
      mesh.position.z = (centerZ - meanZ) * t * SPREAD;
    });
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

export default function ExplodedHolter({
  url = '/holter.glb',
  scale = 0.5,
  explode = true,
  style,
}) {
  return (
    <Canvas
      camera={{ position: [0, 1, 5], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      frameloop="always"
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', background: 'transparent', ...style }}
    >
      <CameraLight />
      <Suspense fallback={null}>
        <ExplodedModel url={url} scale={scale} explode={explode} />
      </Suspense>
    </Canvas>
  );
}
