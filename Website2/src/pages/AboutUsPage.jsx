import { usePageScroll } from '../hooks/usePageScroll';

const Section = ({ isDark, children, alt = false }) => (
  <section className={`min-h-screen flex flex-col justify-center py-6 md:py-10 [@media(max-height:768px)]:py-4 snap-start transition-colors duration-500 ${alt
    ? (isDark ? 'bg-[#050505]' : 'bg-[#f5f5f7]')
    : (isDark ? 'bg-black' : 'bg-[#fdfdfd]')}`}>
    <div className="max-w-7xl mx-auto px-6 w-full">
      {children}
    </div>
  </section>
);

const Tag = ({ isDark, children }) => (
  <span className={`inline-block px-3 py-1 mb-6 rounded-full text-xs font-semibold tracking-widest uppercase ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
    {children}
  </span>
);

const Placeholder = ({ isDark, h = '10rem' }) => (
  <div className={`w-full rounded-2xl sm:rounded-3xl border-2 border-dashed flex items-center justify-center text-sm ${isDark ? 'border-white/10 text-white/20' : 'border-gray-200 text-gray-300'}`} style={{ height: h }}>
    placeholder
  </div>
);

const AboutUsPage = ({ isDark, scrollbarStyles, onBack }) => {
  const { containerRef, handleScroll } = usePageScroll(50, 0, true);

  return (
    <div ref={containerRef} onScroll={handleScroll}
      className={`h-screen overflow-y-auto scroll-smooth font-sans selection:bg-purple-500/30 transition-colors duration-500 ${isDark ? 'bg-black text-white' : 'bg-[#fdfdfd] text-slate-900'} ${scrollbarStyles}`}>

      {/* 1. O projekcie i Comarch */}
      <section className={`min-h-screen flex flex-col justify-center pt-20 pb-6 md:py-10 snap-start transition-colors duration-500 ${isDark ? 'bg-black' : 'bg-[#fdfdfd]'}`}>
        <div className="max-w-7xl mx-auto px-6 w-full">
          <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Studencka Innowacja z Wrocławia
          </h1>
          <p className={`text-sm sm:text-base leading-relaxed mb-6 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Jesteśmy studentami Automatyki i Robotyki na Politechnice Wrocławskiej. Tworzymy Rythmio – innowacyjną odpowiedź na wyzwania współczesnej telemedycyny. Zaprojektowaliśmy w pełni funkcjonalny, miniaturowy Holter EKG, zintegrowany z autorską aplikacją mobilną opartą na algorytmach sztucznej inteligencji. Projekt powstał w ramach Konferencji Projektów Zespołowych.
          </p>

          <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Współpraca z Comarch
          </h2>
          <p className={`text-sm sm:text-base leading-relaxed mb-4 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Partnerem technologicznym i mentorem projektu Rythmio jest firma Comarch. Eksperci lidera branży IT wspierali nas na każdym etapie prac: od konsultacji schematów elektronicznych modułu analogowego (ADS1292), przez optymalizację transmisji Bluetooth (ESP32), aż po standaryzację medyczną raportów klinicznych. Dzięki tej współpracy połączyliśmy wiedzę akademicką z komercyjnym know-how.
          </p>
          <div className="flex justify-center w-full mb-6">
            <img
              src="/logo_comarch_black_w480.svg"
              alt="Comarch"
              className={`h-7 sm:h-9 w-auto ${isDark ? 'invert' : ''}`}
            />
          </div>

          <div className="w-full h-44 md:h-52 rounded-2xl sm:rounded-3xl overflow-hidden">
            <Placeholder isDark={isDark} h="100%" />
          </div>
        </div>
      </section>

      {/* 2. Julia Tomasik */}
      <Section isDark={isDark} alt={true}>
        <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
          <div className="flex-1 min-w-0">
            <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Julia Tomasik</h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Placeholder
            </p>
          </div>
          <div className="w-full lg:w-60 xl:w-72 flex-shrink-0">
            <Placeholder isDark={isDark} h="14rem" />
          </div>
        </div>
      </Section>

      {/* 3. Szymon Czech */}
      <Section isDark={isDark} alt={false}>
        <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
          <div className="flex-1 min-w-0">
            <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Szymon Czech</h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Placeholder
            </p>
          </div>
          <div className="w-full lg:w-60 xl:w-72 flex-shrink-0">
            <Placeholder isDark={isDark} h="14rem" />
          </div>
        </div>
      </Section>

      {/* 4. Paweł Czarzasty */}
      <Section isDark={isDark} alt={true}>
        <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
          <div className="flex-1 min-w-0">
            <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Paweł Czarzasty</h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Placeholder
            </p>
          </div>
          <div className="w-full lg:w-60 xl:w-72 flex-shrink-0">
            <Placeholder isDark={isDark} h="14rem" />
          </div>
        </div>
      </Section>

      {/* 5. Kacper Bizoń */}
      <Section isDark={isDark} alt={false}>
        <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
          <div className="flex-1 min-w-0">
            <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Kacper Bizoń</h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Placeholder
            </p>
          </div>
          <div className="w-full lg:w-60 xl:w-72 flex-shrink-0">
            <Placeholder isDark={isDark} h="14rem" />
          </div>
        </div>
      </Section>

      {/* 6. Karolina Sonka */}
      <Section isDark={isDark} alt={true}>
        <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
          <div className="flex-1 min-w-0">
            <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Karolina Sonka</h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Placeholder
            </p>
          </div>
          <div className="w-full lg:w-60 xl:w-72 flex-shrink-0">
            <Placeholder isDark={isDark} h="14rem" />
          </div>
        </div>
        <div className={`mt-10 pt-8 border-t text-center ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <button onClick={onBack} className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
            ← Wróć do strony głównej
          </button>
        </div>
      </Section>

    </div>
  );
};

export default AboutUsPage;
