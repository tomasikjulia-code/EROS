import { Suspense } from 'react';
import { ArrowRight, Cpu, Layers, Zap, ShieldCheck } from 'lucide-react';
import ExplodedHolter from '../components/ExplodedHolter';

const BULLETS = [
  { Icon: Cpu,         text: 'Autorski obwód drukowany (PCB)' },
  { Icon: Layers,      text: 'Wielowarstwowe filtrowanie sygnału' },
  { Icon: Zap,         text: 'Optymalizacja zużycia energii' },
  { Icon: ShieldCheck, text: 'Izolacja galwaniczna pacjenta' },
];

export default function DevPage({ isDark, onBack, changeView }) {
  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 pt-16 ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f7] text-slate-900'}`}>

      {/* Main content */}
      <div className="flex-1 flex items-center">
        <div className="max-w-7xl mx-auto w-full px-8 md:px-16 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* Lewa kolumna – tekst */}
          <div className="flex flex-col gap-6">
            <h1 className={`text-4xl md:text-5xl font-bold leading-tight tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Inżynieria w<br />najczystszej postaci.
            </h1>

            <p className={`text-base leading-relaxed ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
              Rythmio powstało od zera – od projektu płytki PCB po autorskie
              oprogramowanie wbudowane. Każdy element dobrany tak, aby zapewnić
              precyzję pomiarów na poziomie urządzeń klinicznych.
            </p>

            <ul className="flex flex-col gap-3">
              {BULLETS.map(({ Icon, text }) => (
                <li key={text} className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                  <Icon size={15} className="text-purple-500 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <button
              onClick={() => changeView?.('device')}
              className="flex items-center gap-2 text-purple-500 hover:text-purple-400 transition-colors text-sm font-medium w-fit mt-2"
            >
              Poznaj konstrukcję <ArrowRight size={16} />
            </button>
          </div>

          {/* Prawa kolumna – 3D */}
          <div className={`relative rounded-3xl overflow-hidden aspect-square shadow-2xl ${isDark ? 'bg-[#161616]' : 'bg-white'}`}>
            <Suspense fallback={null}>
              <ExplodedHolter
                url="/holter.glb"
                scale={0.02}
                explode={true}
              />
            </Suspense>
          </div>

        </div>
      </div>
    </div>
  );
}
