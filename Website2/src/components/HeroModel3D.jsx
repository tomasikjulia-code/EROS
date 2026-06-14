import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, RoundedBox } from '@react-three/drei';

const INTRO_DURATION = 3.6;

// Flaga poza komponentem – przeżywa odmontowanie, intro gra tylko raz
let introHasPlayed = false;

// Błyskawiczny start → nieskończenie gładkie wyhamowanie (Apple signature)
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Łagodniejszy wariant do skali – nie tak agresywny jak expo
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

/** Światło przyczepione do kamery – zawsze oświetla to co widzi widz */
function CameraLight({ isDark }) {
  const lightRef = useRef();
  const { camera } = useThree();
  useFrame(() => {
    if (lightRef.current) lightRef.current.position.copy(camera.position);
  });
  return <pointLight ref={lightRef} intensity={isDark ? 4 : 5} decay={0} />;
}

/** Sygnał: odpala onReady przy pierwszej wyrenderowanej klatce */
function SceneReadySignal({ onReady }) {
  const fired = useRef(false);
  const { invalidate } = useThree();

  useEffect(() => { invalidate(); }, [invalidate]);

  useFrame(() => {
    if (!fired.current) {
      fired.current = true;
      onReady();
    }
  });

  return null;
}

/** Animacja intro: pełny obrót + delikatne uniesienie */
function AnimatedScene({ children, onControlsReady, onIntroComplete, skipIntro }) {
  const groupRef = useRef();
  const elapsed = useRef(0);
  const done = useRef(skipIntro);
  const controlsReadyFired = useRef(skipIntro);

  useFrame(({ invalidate }, delta) => {
    if (!groupRef.current || done.current) return;
    elapsed.current = Math.min(elapsed.current + delta, INTRO_DURATION);
    const t = elapsed.current / INTRO_DURATION;

    const expo = easeOutExpo(t);

    groupRef.current.rotation.y = expo * Math.PI * 2;
    groupRef.current.position.y = (expo - 1) * 0.18;
    groupRef.current.scale.setScalar(0.94 + easeOutQuart(t) * 0.06);

    // t=0.5 → easeOutExpo = 96.9% ruchu zakończone, animacja praktycznie niewidoczna
    if (!controlsReadyFired.current && t >= 0.5) {
      controlsReadyFired.current = true;
      onControlsReady?.();
    }

    if (t >= 1) {
      groupRef.current.rotation.y = 0;
      groupRef.current.position.y = 0;
      groupRef.current.scale.setScalar(1);
      done.current = true;
      onIntroComplete?.();
    } else {
      invalidate();
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

/** Placeholder urządzenia, gdy brak pliku GLB */
function DevicePlaceholder() {
  return (
    <group>
      {/* Obudowa */}
      <RoundedBox args={[1.4, 2.0, 0.28]} radius={0.14} smoothness={4}>
        <meshStandardMaterial color="#c8b99a" roughness={0.28} metalness={0.35} />
      </RoundedBox>
      {/* Ekran */}
      <RoundedBox args={[1.0, 0.65, 0.02]} radius={0.05} smoothness={4} position={[0, 0.42, 0.15]}>
        <meshStandardMaterial color="#1a1410" roughness={0.05} metalness={0.1}
          emissive="#7c5c2a" emissiveIntensity={0.25} />
      </RoundedBox>
      {/* Konektor USB u góry */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.18, 12]} />
        <meshStandardMaterial color="#b0a287" roughness={0.35} metalness={0.65} />
      </mesh>
      {/* Złącza elektrod u dołu */}
      {[-0.42, 0, 0.42].map((x, i) => (
        <mesh key={i} position={[x, -1.08, 0]}>
          <cylinderGeometry args={[0.042, 0.034, 0.22, 8]} />
          <meshStandardMaterial color="#a08850" roughness={0.15} metalness={0.88} />
        </mesh>
      ))}
      {/* Przycisk */}
      <mesh position={[0.52, 0.65, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
        <meshStandardMaterial color="#b89060" roughness={0.3} metalness={0.55} />
      </mesh>
    </group>
  );
}

/** Ładuje model GLTF/GLB */
function GLTFModel({ url, scale = 0.5 }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={scale} />;
}

/**
 * Główny komponent: Canvas z modelem 3D.
 * @param {string|null} modelUrl  – ścieżka do pliku .glb (np. "/model.glb"). Jeśli null, wyświetla placeholder.
 * @param {boolean}     isDark    – tryb ciemny (wpływa na oświetlenie)
 */
const HeroModel3D = ({ modelUrl = null, isDark = true, modelScale = 0.5 }) => {
  const [controlsEnabled, setControlsEnabled] = useState(introHasPlayed);
  const [visible, setVisible] = useState(false);

  const handleControlsReady = () => {
    introHasPlayed = true;
    setControlsEnabled(true);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
      background: 'transparent',
    }}>
    <Canvas
      camera={{ position: [0, 0.2, 4.2], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      frameloop="demand"
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <CameraLight isDark={isDark} />

      <SceneReadySignal onReady={() => setVisible(true)} />
      <AnimatedScene
        onControlsReady={handleControlsReady}
        onIntroComplete={null}
        skipIntro={introHasPlayed}
      >
        <Suspense fallback={null}>
          {modelUrl ? <GLTFModel url={modelUrl} scale={modelScale} /> : <DevicePlaceholder />}
        </Suspense>
      </AnimatedScene>

      <OrbitControls
        enabled={controlsEnabled}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI * 0.75}
        rotateSpeed={0.4}
        dampingFactor={0.08}
        enableDamping
      />
    </Canvas>
    </div>
  );
};

export default HeroModel3D;
