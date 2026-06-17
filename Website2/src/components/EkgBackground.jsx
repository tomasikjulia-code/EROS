import { useEffect, useRef, useState } from 'react';

const BASE_W          = 1480; // referencja – full HD wygląda dobrze
const BASE_STRIP_H    = 170;
const BASE_PX_PER_BEAT = 150;
const TPLT_SIZE = 2000; // próbek na jedno uderzenie – wysoka rozdzielczość

// Budujemy szablon jednego uderzenia raz przy ładowaniu modułu.
// t ∈ [0,1) = jedna pełna faza cyklu.
// Ujemna wartość → w górę (oś Y canvasa rośnie w dół).
function buildBeat() {
  const g = (t, mu, s) => Math.exp(-0.5 * ((t - mu) / s) ** 2);
  const buf = new Float32Array(TPLT_SIZE);
  for (let i = 0; i < TPLT_SIZE; i++) {
    const t = i / TPLT_SIZE;
    buf[i] =
      -0.22 * g(t, 0.12, 0.023) +   // P  – mały łagodny garb
       0.14 * g(t, 0.30, 0.008) +   // Q  – krótki dołek
      -1.00 * g(t, 0.33, 0.010) +   // R  – igłowy pik (wąska sigma!)
       0.30 * g(t, 0.37, 0.012) +   // S  – dołek poniżej linii bazowej
      -0.28 * g(t, 0.53, 0.055);    // T  – szeroki garb
  }
  return buf;
}

const BEAT = buildBeat();

// Lerp pomocniczy
const lerp = (a, b, t) => a + (b - a) * t;

// Deterministyczny pseudo-random z seeda – ta sama wartość dla tego samego beatu
const pseudoRand = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x); // [0, 1)
};

const EkgBackground = ({ isDark }) => {
  const canvasRef   = useRef(null);
  const themeT      = useRef(isDark ? 1 : 0);
  const themeTarget = useRef(isDark ? 1 : 0);
  const stripHRef   = useRef(BASE_STRIP_H);
  const pxPerBeatRef = useRef(BASE_PX_PER_BEAT);
  const [stripH, setStripH] = useState(BASE_STRIP_H);

  useEffect(() => { themeTarget.current = isDark ? 1 : 0; }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let animId;
    let totalPhase = 0; // globalne px – nie resetowane, żeby beatNum był spójny

    const resize = () => {
      const scale = Math.min(window.innerWidth / BASE_W, 1); // nie skaluj powyżej referencji
      const h   = Math.round(BASE_STRIP_H    * scale);
      const ppb = Math.round(BASE_PX_PER_BEAT * scale);
      stripHRef.current    = h;
      pxPerBeatRef.current = ppb;
      setStripH(h);
      canvas.width  = window.innerWidth;
      canvas.height = h;
    };
    window.addEventListener('resize', resize);
    resize();

    let lastTime = null;
    const draw = (timestamp) => {
      const delta = lastTime ? Math.min(timestamp - lastTime, 50) : 16.67;
      lastTime = timestamp;

      const w        = canvas.width;
      const stripH   = stripHRef.current;
      const pxPerBeat = pxPerBeatRef.current;
      ctx.clearRect(0, 0, w, stripH);

      // Płynna interpolacja tematu
      const themeSpeed = 1 - Math.pow(0.945, delta / 16.67);
      themeT.current += (themeTarget.current - themeT.current) * themeSpeed;
      const t = themeT.current;

      const pxPerSec  = pxPerBeat * (60 / 90);
      totalPhase += pxPerSec * delta / 1000;

      // Baseline wander – symuluje oddychanie i drżenie elektrody
      const wander =
        Math.sin(totalPhase / 900) * stripH * 0.070 +
        Math.sin(totalPhase / 380 + 1.7) * stripH * 0.025;

      const centerY = stripH * 0.60 + wander;
      const amp     = stripH * 0.42;

      const r = Math.round(lerp(147, 192, t));
      const g = Math.round(lerp(51,  132, t));
      const b = Math.round(lerp(234, 252, t));
      const a = lerp(0.28, 0.85, t);

      const buildPath = () => {
        ctx.beginPath();
        for (let x = 0; x <= w; x++) {
          const globalPos = x + totalPhase;
          const beatNum   = Math.floor(globalPos / pxPerBeat);
          const frac      = (globalPos % pxPerBeat) / pxPerBeat;
          const idx       = Math.min(Math.floor(frac * TPLT_SIZE), TPLT_SIZE - 1);
          // Per-beat amplituda: 0.80..1.00 – czasem mniejszy pik, jak w realnym EKG
          const ampScale  = 0.80 + pseudoRand(beatNum) * 0.20;
          const y = centerY + BEAT[idx] * amp * ampScale;
          x === 0 ? ctx.moveTo(0, y) : ctx.lineTo(x, y);
        }
      };

      ctx.lineJoin   = 'miter';
      ctx.miterLimit = 20;
      ctx.lineCap    = 'round';

      // 1. Glow – szeroki, przezroczysty stroke (tylko w dark mode)
      if (t > 0.01) {
        buildPath();
        ctx.strokeStyle = `rgba(${r},${g},${b},${lerp(0, 0.18, t).toFixed(3)})`;
        ctx.lineWidth   = lerp(0, 10, t);
        ctx.stroke();
      }

      // 2. Właściwa linia
      buildPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
      ctx.lineWidth   = lerp(1.8, 2.2, t);
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      className="absolute left-1/2 top-1/2 z-0 pointer-events-none overflow-hidden"
      style={{
        width: '100vw',
        height: stripH,
        transform: 'translate(-50%, -50%)',
        maskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className={`absolute inset-0 bg-gradient-to-r from-black via-transparent to-black transition-opacity duration-700 ${isDark ? 'opacity-80' : 'opacity-0'}`} />
      {/* Przyciemnienie/rozjaśnienie środka za tytułem – tylko desktop */}
      <div
        className={`absolute inset-0 hidden sm:block transition-opacity duration-700 ${isDark ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'radial-gradient(ellipse 35% 90% at 50% 50%, rgba(0,0,0,0.65) 0%, transparent 100%)' }}
      />
      <div className={`absolute inset-0 bg-gradient-to-r from-[#fdfdfd] via-transparent to-[#fdfdfd] transition-opacity duration-700 ${isDark ? 'opacity-0' : 'opacity-100'}`} />
    </div>
  );
};

export default EkgBackground;
