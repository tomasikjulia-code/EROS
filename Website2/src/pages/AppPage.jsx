import {
  Activity, Brain, Edit3, Maximize2,
  Scissors, AlertTriangle, Download, RefreshCw,
} from 'lucide-react';
import { usePageScroll } from '../hooks/usePageScroll';

const AppPage = ({ isDark, scrollbarStyles, onBack }) => {
  const { containerRef, handleScroll, scrollNext, scrollPrev } = usePageScroll(50, 0, true);

  return (
    <div ref={containerRef} onScroll={handleScroll} className={`h-screen overflow-y-auto scroll-smooth scroll-pt-16 font-sans selection:bg-purple-500/30 transition-colors duration-500 ${isDark ? 'bg-black text-white' : 'bg-[#fdfdfd] text-slate-900'} ${scrollbarStyles}`}>

      {/* Sekcja 1: Hero */}
      <section className="relative min-h-screen flex flex-col justify-center pt-16 pb-10 [@media(max-height:768px)]:pt-24 [@media(max-height:768px)]:pb-6 snap-start overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 w-full flex flex-col lg:flex-row items-center gap-10 sm:gap-16 relative z-10">
          <div className="flex-1 text-center lg:text-left">
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Kardiologia Live w Twoim Telefonie.</h1>
            <p className={`text-base sm:text-lg leading-relaxed max-w-lg ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Rythmio stanowi centrum dowodzenia Twoim sercem. Po nawiązaniu połączenia Bluetooth z urządzeniem masz pełną kontrolę nad badaniem i natychmiastowy wgląd w kondycję organizmu.</p>
          </div>
          <div className="flex-1 w-full flex justify-center relative mt-4 lg:mt-0">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`}
              style={{ boxShadow: '0 0 40px 20px rgba(147,51,234,0.4), 0 0 100px 50px rgba(147,51,234,0.15)' }} />
            <div className={`relative z-10 p-[4px] sm:p-[6px] rounded-[2.5rem] sm:rounded-[3.2rem] shadow-2xl w-full max-w-[240px] sm:max-w-[300px] ${isDark ? 'bg-gray-800' : 'bg-gray-300'}`}>
              <div className="relative rounded-[2.3rem] sm:rounded-[2.8rem] overflow-hidden bg-black border-[6px] sm:border-[10px] border-black">
                <img src="/images/app-landing.jpg" alt="Aplikacja Rythmio" className="w-full h-auto block" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sekcja 2: Live & Status */}
      <section className={`min-h-screen flex flex-col justify-center pt-20 pb-8 md:pt-24 md:pb-14 [@media(max-height:768px)]:pt-16 [@media(max-height:768px)]:pb-6 snap-start border-y transition-colors duration-500 ${isDark ? 'bg-[#050505] border-white/5' : 'bg-[#f5f5f7] border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="mb-6 md:mb-10 [@media(max-height:768px)]:mb-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">Podgląd w czasie rzeczywistym.</h2>
            <p className={`text-base sm:text-lg max-w-2xl leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Wszystko, czego potrzebujesz — jednym tapnięciem.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: <Activity size={20} />, title: 'EKG na żywo', desc: 'Tryb Live strumieniuje sygnał EKG w czasie rzeczywistym na ekran smartfona. Idealne do natychmiastowej weryfikacji poprawności zapisu.' },
              { icon: <RefreshCw size={20} />, title: 'Szybki status', desc: 'Ikona odświeżania pobiera ze sprzętu aktualny poziom baterii, status elektrod i potwierdzenie stabilności pomiaru.' },
              { icon: <Maximize2 size={20} />, title: 'Skalowalny widok', desc: 'Wykresy EKG i tętna są w pełni skalowalne poziomo i pionowo. Interfejs dopasowuje się do orientacji telefonu.' },
            ].map((item, i) => (
              <div key={i} className={`p-5 sm:p-6 rounded-2xl border transition-colors ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/5 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>{item.icon}</div>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ekran 2: Pobieranie i Analiza */}
      <section className={`min-h-screen flex flex-col justify-center pt-20 pb-8 md:pt-24 md:pb-14 [@media(max-height:768px)]:pt-16 [@media(max-height:768px)]:pb-6 snap-start border-y transition-colors duration-500 ${isDark ? 'bg-black border-white/5' : 'bg-[#fdfdfd] border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-8 lg:gap-12 [@media(max-height:768px)]:gap-6 items-center">
          <div className="order-2 lg:order-2">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl [@media(max-height:768px)]:text-3xl font-bold mb-4 sm:mb-6 [@media(max-height:768px)]:mb-3 text-center lg:text-left">Pobieranie i Automatyczna Analiza</h2>
            <p className={`text-base sm:text-lg [@media(max-height:768px)]:text-sm mb-6 sm:mb-8 [@media(max-height:768px)]:mb-4 leading-relaxed text-center lg:text-left ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Kliknięcie ikony synchronizacji uruchamia szybki transfer zapisanego materiału z karty microSD wprost do pamięci telefonu.</p>
            <div className={`p-5 sm:p-8 [@media(max-height:768px)]:p-4 rounded-2xl sm:rounded-3xl mb-6 sm:mb-8 [@media(max-height:768px)]:mb-4 ${isDark ? 'bg-white/5' : 'bg-white shadow-sm border border-gray-100'}`}>
              <h3 className="font-bold mb-4 sm:mb-6 [@media(max-height:768px)]:mb-3 text-base sm:text-lg [@media(max-height:768px)]:text-base">Wskaźniki aktualizowane po synchronizacji:</h3>
              <div className="space-y-3 sm:space-y-4 [@media(max-height:768px)]:space-y-1">
                {[
                  { title: 'Czas trwania zapisu', desc: 'Precyzyjny licznik czasu zapisanego badania' },
                  { title: 'Trendy tętna', desc: 'Automatyczne wyznaczenie średniego, najniższego oraz najwyższego BPM' },
                  { title: 'Licznik arytmii', desc: 'Suma zarejestrowanych dobowych epizodów anomalii' },
                  { title: 'Wizualizacja graficzna', desc: 'Generowanie wykresu dobowego tętna oraz wykresu średniej aktywności fizycznej' },
                ].map((item, i) => (
                  <div key={i} className={`flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 [@media(max-height:768px)]:py-1.5 border-b last:border-0 ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                    <span className="font-semibold sm:w-1/3 mb-1 sm:mb-0 [@media(max-height:768px)]:mb-0 text-sm sm:text-base [@media(max-height:768px)]:text-sm">{item.title}</span>
                    <span className={`text-xs sm:text-sm [@media(max-height:768px)]:text-xs sm:w-2/3 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`flex gap-3 sm:gap-4 [@media(max-height:768px)]:gap-2 p-4 [@media(max-height:768px)]:p-3 rounded-xl sm:rounded-2xl ${isDark ? 'bg-purple-500/10 text-purple-200' : 'bg-purple-50 text-purple-800'}`}>
              <Activity className="flex-shrink-0 mt-1" size={18} />
              <p className="text-xs sm:text-sm leading-relaxed">Dzięki korelacji tętna z akcelerometrem wbudowanym w urządzenie, od razu widzisz, czy wyższy puls wynikał z wysiłku, czy był niepokojącą anomalią.</p>
            </div>
          </div>
          <div className="relative order-1 lg:order-1 flex justify-center">
            <div className={`absolute inset-0 bg-gradient-to-tr blur-3xl rounded-full -z-10 w-full max-w-sm mx-auto ${isDark ? 'from-indigo-600/20 to-purple-600/20' : 'from-indigo-400/20 to-purple-400/20'}`} />
            <div className={`relative z-10 p-[4px] sm:p-[6px] rounded-[2.5rem] sm:rounded-[3.2rem] shadow-2xl w-full max-w-[240px] sm:max-w-[300px] ${isDark ? 'bg-gray-800' : 'bg-gray-300'}`}>
              <div className="relative rounded-[2.3rem] sm:rounded-[2.8rem] overflow-hidden bg-black border-[6px] sm:border-[10px] border-black">
                <img src="/images/trendy.jpeg" alt="Pulpit Aplikacji" className="w-full h-auto block" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ekran 3: Raport Kliniczny i AI */}
      <section className={`min-h-screen flex flex-col justify-center pt-20 pb-8 md:pt-24 md:pb-14 [@media(max-height:768px)]:pt-16 [@media(max-height:768px)]:pb-6 snap-start relative overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#050505]' : 'bg-[#f5f5f7]'}`}>
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 [@media(max-height:768px)]:gap-6 items-center">
            {/* Lewa kolumna: treść */}
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl [@media(max-height:768px)]:text-3xl font-bold mb-4 sm:mb-6 [@media(max-height:768px)]:mb-3 text-center lg:text-left">Raport Kliniczny i Wsparcie AI</h2>
              <p className={`text-base sm:text-lg [@media(max-height:768px)]:text-sm leading-relaxed mb-6 sm:mb-8 [@media(max-height:768px)]:mb-4 text-center lg:text-left ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Z poziomu aplikacji jednym kliknięciem wygenerujesz kompleksowy <strong>Raport Kliniczny</strong>.</p>
              <div className="flex flex-col gap-4 sm:gap-6 [@media(max-height:768px)]:gap-3 mb-6 sm:mb-8 [@media(max-height:768px)]:mb-4">
                <div className={`p-6 sm:p-8 [@media(max-height:768px)]:p-4 rounded-2xl sm:rounded-3xl relative overflow-hidden transition-colors ${isDark ? 'bg-white/5 border border-white/5' : 'bg-white border border-gray-100 shadow-md'}`}>
                  <div className="absolute top-0 left-0 w-2 h-full bg-green-500" />
                  <div className="flex items-center gap-3 mb-3 sm:mb-4 [@media(max-height:768px)]:mb-2"><Edit3 className="text-green-500" size={20} /><h3 className={`text-base sm:text-lg [@media(max-height:768px)]:text-base font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>Dziennik Zdarzeń i Notatki Pacjenta</h3></div>
                  <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Gdy podczas badania poczujesz się gorzej i wciśniesz <strong>dolny przycisk na obudowie urządzenia</strong>, system postawi znacznik w sygnale.</p>
                </div>
                <div className={`p-6 sm:p-8 [@media(max-height:768px)]:p-4 rounded-2xl sm:rounded-3xl relative overflow-hidden transition-colors ${isDark ? 'bg-white/5 border border-white/5' : 'bg-white border border-gray-100 shadow-md'}`}>
                  <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
                  <div className="flex items-center gap-3 mb-3 sm:mb-4 [@media(max-height:768px)]:mb-2"><Brain className="text-indigo-500" size={20} /><h3 className={`text-base sm:text-lg [@media(max-height:768px)]:text-base font-semibold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Zintegrowany Asystent AI</h3></div>
                  <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Wbudowany moduł AI klasyfikuje epizody jako "łagodne" lub "krytyczne" i dostarcza wstępne zalecenia.</p>
                </div>
              </div>
              <div className={`p-5 sm:p-6 [@media(max-height:768px)]:p-4 rounded-2xl sm:rounded-3xl mb-6 sm:mb-8 [@media(max-height:768px)]:mb-4 flex flex-col sm:flex-row items-center text-center sm:text-left gap-4 sm:gap-6 [@media(max-height:768px)]:gap-4 ${isDark ? 'bg-[#111] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 [@media(max-height:768px)]:w-10 [@media(max-height:768px)]:h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500"><Scissors size={20} /></div>
                <div>
                  <h3 className="text-base sm:text-lg [@media(max-height:768px)]:text-base font-bold mb-1">Przegląd anomalii i wycinków</h3>
                  <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Aplikacja automatycznie wycina momenty anomalii. Wszystkie wycinki są w pełni <strong>interaktywne i skalowalne</strong>.</p>
                </div>
              </div>
              <div className={`text-center p-4 sm:p-5 [@media(max-height:768px)]:p-3 rounded-xl sm:rounded-2xl ${isDark ? 'bg-white/5' : 'bg-purple-600 text-white shadow-xl'}`}>
                <p className="font-medium text-sm sm:text-base [@media(max-height:768px)]:text-sm flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                  <Download size={16} /><span>Gotowe opracowanie możesz natychmiast zapisać w formacie PDF i przesłać kardiologowi.</span>
                </p>
              </div>
            </div>

            {/* Prawa kolumna: raport AI 1:1 */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[360px] sm:max-w-[420px]">
                <div className={`absolute inset-0 bg-gradient-to-tr blur-3xl rounded-full -z-10 ${isDark ? 'from-indigo-600/20 to-purple-600/20' : 'from-indigo-400/20 to-purple-400/20'}`} />
                <img
                  src="/images/app-ai.jpg"
                  alt="Raport AI"
                  className={`w-full aspect-square rounded-2xl sm:rounded-3xl border-[6px] sm:border-[8px] shadow-2xl object-cover ${isDark ? 'border-gray-900' : 'border-gray-100'}`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ekran 4: Dodatkowe & Uwaga */}
      <section className={`min-h-screen flex flex-col justify-center pt-20 pb-8 md:pt-24 md:pb-14 [@media(max-height:768px)]:pt-16 [@media(max-height:768px)]:pb-6 snap-start border-t transition-colors duration-500 ${isDark ? 'bg-black border-white/5' : 'bg-[#fdfdfd] border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="text-center mb-6 sm:mb-10 [@media(max-height:768px)]:mb-3">
            <h2 className="text-3xl sm:text-4xl [@media(max-height:768px)]:text-2xl font-bold mb-4 [@media(max-height:768px)]:mb-2">Dodatkowe Możliwości Aplikacji</h2>
            <p className={`text-sm sm:text-base max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Rythmio to nie tylko bieżący pomiar, ale też wygodne zarządzanie historią zdrowia.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 [@media(max-height:768px)]:gap-4 mb-10 sm:mb-16 [@media(max-height:768px)]:mb-4">
            {[
              { title: 'Dedykowane Archiwum', desc: 'Osobna zakładka historyczna gromadzi wszystkie wykonane do tej pory badania kardiologiczne.' },
              { title: 'Asystent Głosowy', desc: 'System regularnie odczytuje komunikaty głosowe o zaktualizowanych danych telemetrycznych.' },
              { title: 'Bezpieczeństwo Danych', desc: 'Wszystkie badania zapisywane lokalnie podlegają restrykcyjnemu szyfrowaniu. Eksport PDF/CSV.' },
            ].map((card, i) => (
              <div key={i} className={`p-6 sm:p-8 [@media(max-height:768px)]:p-4 rounded-2xl sm:rounded-3xl transition-colors ${isDark ? 'bg-white/5 border border-white/5' : 'bg-white border border-gray-100 shadow-sm'}`}>
                <h3 className="text-lg sm:text-xl [@media(max-height:768px)]:text-base font-semibold mb-3 sm:mb-4 [@media(max-height:768px)]:mb-2">{card.title}</h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{card.desc}</p>
              </div>
            ))}
          </div>
          <div className={`p-6 sm:p-8 [@media(max-height:768px)]:p-4 rounded-2xl sm:rounded-3xl border-l-4 border-red-500 ${isDark ? 'bg-[#1a0f14] border-r border-y border-red-900/50' : 'bg-red-50 border-r border-y border-red-200 shadow-sm'}`}>
            <div className="flex items-center gap-3 mb-3 sm:mb-4 [@media(max-height:768px)]:mb-2 text-red-500">
              <AlertTriangle size={20} className="sm:w-6 sm:h-6" />
              <h3 className="font-bold text-base sm:text-lg [@media(max-height:768px)]:text-sm">Ważna uwaga medyczna</h3>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-red-900'}`}>Wykrycie przez algorytmy aplikacji lub moduł AI znacznej liczby epizodów arytmicznych wymaga weryfikacji lekarskiej. Wygenerowane raporty mają charakter wyłącznie informacyjny i <strong>nie zastępują profesjonalnej diagnozy medycznej</strong>.</p>
          </div>
          <div className={`mt-10 pt-8 [@media(max-height:768px)]:mt-4 [@media(max-height:768px)]:pt-4 border-t text-center ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
            <button onClick={onBack} className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
              ← Wróć do strony głównej
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

export default AppPage;
