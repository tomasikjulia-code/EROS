import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import {
  HeartPulse, ArrowRight, Play,
  Activity, ChevronDown, Sun, Moon, X, Menu,
  Cpu, Layers, Zap, ShieldCheck,
} from 'lucide-react';
import EkgBackground from '../components/EkgBackground';
import HeroModel3D from '../components/HeroModel3D';

import { usePageScroll } from '../hooks/usePageScroll';

const LandingPage = ({ isDark, toggleTheme, changeView, mobileMenuOpen, setMobileMenuOpen, scrollbarStyles, scrollMemory }) => {
  const { isScrolled, isAtBottom, containerRef, handleScroll, scrollNext, scrollPrev } =
    usePageScroll(
      typeof window !== 'undefined' ? window.innerHeight * 0.8 : 600,
      scrollMemory?.current ?? 0,
    );

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const [scrollbarVisible, setScrollbarVisible] = useState(!isDesktop);
  const scrollbarTimer = useRef(null);

  useEffect(() => {
    if (!isDesktop) return;
    clearTimeout(scrollbarTimer.current);
    if (isScrolled) {
      setScrollbarVisible(true);
    } else {
      scrollbarTimer.current = setTimeout(() => setScrollbarVisible(false), 700);
    }
    return () => clearTimeout(scrollbarTimer.current);
  }, [isScrolled, isDesktop]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (scrollMemory?.current) {
      el.style.scrollBehavior = 'auto';
      el.scrollTop = scrollMemory.current;
      requestAnimationFrame(() => { el.style.scrollBehavior = ''; });
    }
    const save = () => { if (scrollMemory) scrollMemory.current = el.scrollTop; };
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, []);

  // Blokada scrolla gdy menu mobilne otwarte
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { el.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Zamknij menu gdy viewport przejdzie na desktop (lg = 1024px)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onBreakpoint = (e) => { if (e.matches) setMobileMenuOpen(false); };
    mq.addEventListener('change', onBreakpoint);
    return () => mq.removeEventListener('change', onBreakpoint);
  }, []);

  const [activeSection, setActiveSection] = useState('pulpit');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ids = ['pulpit', 'urzadzenie', 'aplikacja', 'o-nas', 'opinie', 'kontakt'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root: container, threshold: 0.5 }
    );
    ids.forEach(id => {
      const el = container.querySelector(`#${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [containerRef]);

  const carouselRef = useRef(null);
  const heroScrolled = useRef(false);
  const mobileMenuOpenRef = useRef(mobileMenuOpen);
  useEffect(() => { mobileMenuOpenRef.current = mobileMenuOpen; }, [mobileMenuOpen]);

  const isSnapping = useRef(false);
  const snapTimerRef = useRef(null);
  const lockSnap = () => {
    isSnapping.current = true;
    clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => { isSnapping.current = false; }, 750);
  };

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleChevronClick = () => {
    const el = containerRef.current;
    if (!el) return;
    const sections = Array.from(el.querySelectorAll('section'));
    if (sections[1]) {
      const nav = document.querySelector('nav');
      const navH = nav ? nav.offsetHeight : 0;
      el.scrollTo({ top: sections[1].offsetTop - navH, behavior: 'smooth' });
      heroScrolled.current = true;
      lockSnap();
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getSections = () => Array.from(el.querySelectorAll('section'));

    // Zwraca indeks sekcji, której górna krawędź jest najbliżej scrollTop
    // Próg +50 uwzględnia scroll-padding-top: 32px
    const getCurrentIdx = (sections) => {
      let best = 0;
      sections.forEach((sec, i) => {
        if (sec.offsetTop <= el.scrollTop + 50) best = i;
      });
      return best;
    };

    const snapToIdx = (idx, sections) => {
      const clamped = Math.max(0, Math.min(idx, sections.length - 1));
      el.scrollTo({ top: sections[clamped].offsetTop, behavior: 'smooth' });
      heroScrolled.current = clamped > 0;
      lockSnap();
    };

    const onWheel = (e) => {
      if (mobileMenuOpenRef.current) { e.preventDefault(); return; }
      if (isSnapping.current) { e.preventDefault(); return; }

      const isDesktop = window.innerWidth >= 1024;

      if (isDesktop) {
        // Desktop: snap po każdej sekcji
        e.preventDefault();
        const sections = getSections();
        const idx = getCurrentIdx(sections);
        snapToIdx(idx + (e.deltaY > 0 ? 1 : -1), sections);
        return;
      }

      // Mobile/tablet: tylko snap na granicy hero
      const NAVBAR = 32; // scroll-padding-top
      const sections = getSections();
      const nextTop = sections[1] ? sections[1].offsetTop - NAVBAR : el.clientHeight;
      const heroHeight = el.clientHeight;
      if (!heroScrolled.current && el.scrollTop === 0 && e.deltaY > 0) {
        e.preventDefault();
        el.scrollTo({ top: nextTop, behavior: 'smooth' });
        heroScrolled.current = true;
        lockSnap();
        return;
      }
      if (el.scrollTop > 0 && el.scrollTop <= heroHeight && e.deltaY < 0) {
        e.preventDefault();
        el.scrollTo({ top: 0, behavior: 'smooth' });
        heroScrolled.current = false;
        lockSnap();
      }
    };

    let touchStartY = 0;
    let touchOnModel = false;
    const onTouchStart = (e) => {
      touchOnModel = !!e.target.closest('canvas');
      if (touchOnModel) return;
      touchStartY = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      if (mobileMenuOpenRef.current || touchOnModel || isSnapping.current) return;
      const NAVBAR = 32;
      const sections = getSections();
      const nextTop = sections[1] ? sections[1].offsetTop - NAVBAR : el.clientHeight;
      const heroHeight = el.clientHeight;
      const deltaY = touchStartY - e.changedTouches[0].clientY;
      if (!heroScrolled.current && el.scrollTop === 0 && deltaY > 30) {
        el.scrollTo({ top: nextTop, behavior: 'smooth' });
        heroScrolled.current = true;
        lockSnap();
        return;
      }
      if (el.scrollTop > 0 && el.scrollTop <= heroHeight && deltaY < -30) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
        heroScrolled.current = false;
        lockSnap();
      }
    };

    const onScroll = () => {
      if (el.scrollTop === 0) heroScrolled.current = false;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('scroll', onScroll);
      clearTimeout(snapTimerRef.current);
    };
  }, [containerRef]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`h-[100dvh] overflow-y-auto scroll-smooth font-sans selection:bg-purple-500/30 transition-colors duration-500 [scroll-padding-top:32px] [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:[transition:background-color_1.2s_ease] ${isDark ? 'bg-black text-white' : 'bg-[#fdfdfd] text-slate-900'} ${scrollbarVisible ? (isDark ? '[&::-webkit-scrollbar-thumb]:bg-purple-500/40' : '[&::-webkit-scrollbar-thumb]:bg-purple-600/40') : '[&::-webkit-scrollbar-thumb]:bg-transparent'}`}
    >
      {/* Navbar */}
      <nav className={`fixed w-full z-50 top-0 transition-colors duration-300 border-b ${isScrolled || mobileMenuOpen ? (isDark ? 'bg-[#1d1d1f] border-white/10' : 'bg-white border-gray-200') : 'bg-transparent border-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center py-4">
          <button onClick={() => scrollTo('pulpit')} className={`flex items-center gap-2 transition-all duration-500 ${isScrolled || mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
            <img src="/rythmio.svg" alt="Rythmio" className="w-6 h-6 sm:w-7 sm:h-7" />
            <span className="text-lg sm:text-xl font-semibold tracking-tight">Rythmio</span>
          </button>
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-8">
            <div className={`hidden lg:flex gap-6 lg:gap-8 text-sm font-medium items-center transition-all duration-500 ${isScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'} ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              {[['urzadzenie', 'Urządzenie'], ['aplikacja', 'Aplikacja'], ['o-nas', 'My'], ['opinie', 'Opinie'], ['kontakt', 'Kontakt']].map(([id, label]) => (
                <button key={id} onClick={() => scrollTo(id)} className={`transition-colors ${
                  activeSection === id
                    ? isDark ? 'text-white' : 'text-slate-900'
                    : isDark ? 'hover:text-purple-400' : 'hover:text-purple-600'
                }`}>{label}</button>
              ))}
              <div className={`w-px h-4 mx-2 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
            </div>
            {/* Mobile: hamburger i toggle w tym samym slocie, nakładają się */}
            <div className="relative w-10 h-10 lg:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`absolute inset-0 flex items-center justify-center rounded-full transition-all duration-500 ${isScrolled || mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-slate-500 hover:bg-gray-100'}`} aria-label="Menu">
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <button onClick={toggleTheme} className={`absolute inset-0 flex items-center justify-center rounded-full transition-all duration-500 ${isScrolled || mobileMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-slate-500 hover:bg-gray-100'}`} aria-label="Przełącz motyw">
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
            {/* Desktop: toggle zawsze widoczny */}
            <button onClick={toggleTheme} className={`hidden lg:block p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-slate-500'}`} aria-label="Przełącz motyw">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`lg:hidden fixed inset-0 z-40 pt-20 transition-all duration-500 flex flex-col items-center justify-center gap-8 ${isDark ? 'bg-[#0a0a0a]/95' : 'bg-white/95'} backdrop-blur-xl ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={() => { scrollTo('pulpit'); setMobileMenuOpen(false); }} className="flex items-center gap-2 mb-2">
          <img src="/rythmio.svg" alt="Rythmio" className="w-6 h-6" />
          <span className={`text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Rythmio</span>
        </button>
        {[['urzadzenie', 'Urządzenie'], ['aplikacja', 'Aplikacja'], ['o-nas', 'My'], ['opinie', 'Opinie'], ['kontakt', 'Kontakt']].map(([id, label]) => (
          <button key={id} onClick={() => { scrollTo(id); setMobileMenuOpen(false); }} className={`text-2xl font-medium transition-colors ${isDark ? 'text-white hover:text-purple-400' : 'text-slate-900 hover:text-purple-600'}`}>{label}</button>
        ))}
        <div className={`w-16 h-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
        <button onClick={() => { toggleTheme(); setMobileMenuOpen(false); }} className={`flex items-center gap-2 text-base font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {isDark ? 'Tryb jasny' : 'Tryb ciemny'}
        </button>
      </div>

      {/* Hero Section */}
      <section className={`relative min-h-[100dvh] flex flex-col items-center pt-16 sm:pt-28 [@media(max-height:768px)]:pt-20 overflow-hidden transition-colors duration-500 ${isDark ? 'bg-black' : 'bg-[#fdfdfd]'}`} id="pulpit">
        <div className="relative z-10 flex flex-col items-center text-center px-4 sm:px-6 w-full lg:flex-1 [@media(max-height:768px)]:flex-none pointer-events-none">
          <div className="relative w-full flex justify-center mb-2 mt-2 sm:mt-6 md:mt-8 [@media(max-height:768px)]:mt-2">
            <EkgBackground isDark={isDark} />
            <h1 className={`relative z-10 text-5xl sm:text-5xl md:text-7xl lg:text-[6rem] [@media(max-height:768px)]:text-4xl font-semibold tracking-tighter transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>Rythmio</h1>
          </div>
          <h2 className={`relative z-10 text-lg sm:text-2xl md:text-3xl lg:text-4xl [@media(max-height:768px)]:text-base font-normal tracking-tight mb-4 sm:mb-8 [@media(max-height:768px)]:mb-3 transition-colors duration-500 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Twój osobisty kardiolog w kieszeni.</h2>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mb-2 sm:mb-12 [@media(max-height:768px)]:mb-4 pointer-events-auto">
            <button onClick={scrollNext} className="w-auto px-8 sm:px-8 py-3 sm:py-3.5 bg-purple-600 text-white rounded-full text-base font-medium hover:bg-purple-500 transition-all shadow-[0_0_20px_rgba(147,51,234,0.2)] hover:shadow-[0_0_30px_rgba(147,51,234,0.4)]">Poznaj Rythmio</button>
            <button onClick={() => changeView('video')} className={`w-auto px-8 sm:px-8 py-3 sm:py-3.5 rounded-full text-base font-medium transition-colors flex items-center justify-center gap-2 ${isDark ? 'text-white bg-white/5 hover:bg-white/10' : 'text-slate-900 bg-gray-100 hover:bg-gray-200'}`}>
              Zobacz wideo <Play size={16} className={isDark ? 'text-purple-500' : 'text-purple-600'} fill="currentColor" />
            </button>
            {/* TMP */}

          </div>
        </div>
        <div className="w-full max-w-5xl mx-auto flex-1 relative flex justify-center items-center lg:items-end -mt-6 lg:mt-auto pb-2 sm:pb-6 lg:pb-12 xl:pb-32 [@media(max-height:768px)]:pb-2 pointer-events-none">
          <div className={`absolute bottom-0 inset-x-0 h-3/4 pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgba(147,51,234,0.22) 0%, transparent 70%)' }} />
          <div className="relative z-10 w-full h-[45dvh] sm:h-[40dvh] lg:h-[42dvh] [@media(max-height:768px)]:h-[55dvh]">
            {/* Canvas pełna szerokość – model nie przycięty */}
            <div className="absolute inset-0 pointer-events-auto">
              <HeroModel3D modelUrl="/holter.glb" isDark={isDark} modelScale={0.0275} />
            </div>
            {/* Strefy boczne – na mobilce przechwytują touch dla scrolla, nie dla modelu */}
            <div className="absolute inset-y-0 left-0 w-[clamp(2rem,15%,6rem)] z-10 pointer-events-auto" />
            <div className="absolute inset-y-0 right-0 w-[clamp(2rem,15%,6rem)] z-10 pointer-events-auto" />
          </div>
        </div>
        <div onClick={handleChevronClick} className={`absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer transition-opacity duration-500 z-40 ${isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <ChevronDown size={28} className={`sm:w-8 sm:h-8 animate-bounce drop-shadow-md transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'}`} />
        </div>
      </section>


      {/* Konstrukcja Section */}
      <section className={`min-h-screen flex items-center py-8 md:py-20 [@media(max-height:768px)]:py-6 relative border-y transition-colors duration-500 ${isDark ? 'bg-[#050505] border-white/5' : 'bg-[#f5f5f7] border-gray-200'}`} id="urzadzenie">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-10 sm:gap-16">
          <div className="flex-1 text-center md:text-left">
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>Inżynieria w najczystszej postaci.</h2>
            <p className={`text-sm sm:text-lg mb-6 sm:mb-8 leading-relaxed transition-colors duration-500 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Rythmio powstało od zera – od projektu płytki PCB po autorskie oprogramowanie wbudowane. Każdy element dobrany tak, aby zapewnić precyzję pomiarów na poziomie urządzeń klinicznych.</p>
            <ul className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 text-left w-fit mx-auto md:mx-0">
              {[
                { icon: <Cpu size={12} className="sm:w-3.5 sm:h-3.5" />, text: 'Autorski obwód drukowany (PCB)' },
                { icon: <Layers size={12} className="sm:w-3.5 sm:h-3.5" />, text: 'Wielowarstwowe filtrowanie sygnału' },
                { icon: <Zap size={12} className="sm:w-3.5 sm:h-3.5" />, text: 'Optymalizacja zużycia energii' },
                { icon: <ShieldCheck size={12} className="sm:w-3.5 sm:h-3.5" />, text: 'Izolacja galwaniczna pacjenta' },
              ].map((item, i) => (
                <li key={i} className={`flex items-center gap-3 text-xs sm:text-sm md:text-base ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>{item.icon}</div>
                  {item.text}
                </li>
              ))}
            </ul>
            <button onClick={() => changeView('device')} className={`font-semibold text-base sm:text-lg mx-auto md:mx-0 justify-center transition-colors flex items-center gap-2 group ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
              Poznaj lepiej Nasze urządzenie
              <ArrowRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="flex-1 w-full flex justify-center md:justify-end">
            <div className="relative w-full max-w-lg sm:max-w-xl">
              <div className={`absolute -inset-4 rounded-3xl blur-2xl -z-10 ${isDark ? 'bg-purple-600/15' : 'bg-purple-400/10'}`} />
              <img src="/images/holter-landing_alt.jpg" alt="Urządzenie Rythmio" className={`w-full h-auto object-cover rounded-2xl shadow-2xl border-4 transition-colors duration-500 ${isDark ? 'border-white/5' : 'border-white'}`} />
            </div>
          </div>
        </div>
      </section>

      {/* App CTA Section */}
      <section className={`min-h-screen flex items-center py-8 md:py-20 [@media(max-height:768px)]:py-6 relative overflow-hidden transition-colors duration-500 ${isDark ? 'bg-black' : 'bg-[#fdfdfd]'}`} id="aplikacja">
        <div className="max-w-7xl mx-auto px-6 flex flex-col-reverse md:flex-row items-center gap-10 sm:gap-16">
          <div className="flex-1 w-full flex justify-center md:justify-start">
            <div className="relative w-full max-w-[260px] sm:max-w-[300px] [@media(max-height:768px)]:max-w-[280px]">
              <div
                className={`absolute top-1/3 left-1/2 w-0 h-0 pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`}
                style={{ boxShadow: '0 0 30px 15px rgba(147,51,234,0.55), 0 0 70px 35px rgba(147,51,234,0.2), 0 0 120px 55px rgba(147,51,234,0.08)' }}
              />
              <div className={`relative z-10 p-[4px] sm:p-[6px] rounded-[2.5rem] sm:rounded-[3.2rem] shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-gray-300'}`}>
                <div className="relative rounded-[2.3rem] sm:rounded-[2.8rem] overflow-hidden bg-black border-[6px] sm:border-[10px] border-black">
                  <img src="/images/app-landing.jpg" alt="Aplikacja Mobilna Rythmio" className="w-full h-auto block" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pełna kontrola w dedykowanej aplikacji.</h2>
            <p className={`text-sm sm:text-lg mb-6 sm:mb-8 leading-relaxed transition-colors duration-500 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>Zaprojektowaliśmy interfejs tak, aby był maksymalnie czytelny. Sprawdzaj stan baterii, jakość sygnału elektrod i monitoruj wykres EKG na żywo.</p>
            <ul className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 text-left w-fit mx-auto md:mx-0">
              {['Diagnostyka urządzenia na żywo', 'Precyzyjny podgląd wykresu (do 350 px/s)', 'Historia badań i pobieranie danych'].map((item, i) => (
                <li key={i} className={`flex items-center gap-3 text-xs sm:text-sm md:text-base ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}><Activity size={12} className="sm:w-3.5 sm:h-3.5" /></div>
                  {item}
                </li>
              ))}
            </ul>
            <button onClick={() => changeView('app')} className={`font-semibold text-base sm:text-lg mx-auto md:mx-0 justify-center transition-colors flex items-center gap-2 group ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
              Zobacz aplikację
              <ArrowRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* O nas Section */}
      <section className={`min-h-screen flex flex-col justify-center py-8 md:py-16 [@media(max-height:900px)]:py-8 [@media(max-height:768px)]:py-6 relative border-y transition-colors duration-500 ${isDark ? 'bg-[#050505] border-white/5' : 'bg-[#f5f5f7] border-gray-200'}`} id="o-nas">
        <div className="max-w-7xl mx-auto px-6 text-center z-10 w-full">
          <div className="mb-6 sm:mb-12 [@media(max-height:900px)]:mb-4 [@media(max-height:768px)]:mb-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5 sm:mb-8 [@media(max-height:900px)]:mb-3 [@media(max-height:768px)]:mb-3">Nasza misja.</h2>
            <img
              src="/images/grupowe_crop.jpg"
              alt="Zespół Rythmio"
              className={`block mx-auto w-auto max-w-full max-h-[50vh] [@media(max-height:900px)]:max-h-[38vh] rounded-2xl sm:rounded-3xl shadow-xl mb-5 sm:mb-8 [@media(max-height:900px)]:mb-3 [@media(max-height:768px)]:mb-3 transition-colors duration-500 ${isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-gray-200'}`}
            />
            <p className={`text-sm sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-5 sm:mb-8 [@media(max-height:900px)]:mb-3 [@media(max-height:900px)]:text-base [@media(max-height:768px)]:mb-3 [@media(max-height:768px)]:text-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Wierzymy, że zaawansowana diagnostyka kardiologiczna powinna być dostępna dla każdego. Tworzymy Rythmio, aby znieść bariery technologiczne i finansowe w monitorowaniu zdrowia serca.</p>
            <button onClick={() => changeView('about-us')} className={`inline-flex items-center gap-2 font-semibold text-base sm:text-lg group transition-colors ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'}`}>
              Poznaj nas
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>


        </div>
      </section>

      {/* Opinie Section */}
      <section className={`min-h-screen flex flex-col justify-center py-8 md:py-20 [@media(max-height:768px)]:py-6 relative transition-colors duration-500 ${isDark ? 'bg-black' : 'bg-[#fdfdfd]'}`} id="opinie">
        <div className="max-w-3xl mx-auto px-6 w-full text-center">
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>Co mówią o nas.</h2>
          <p className={`text-base sm:text-lg mb-4 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            W trakcie pracy nad Rythmio konsultowaliśmy nasze rozwiązania z lekarzami, fizjoterapeutami i studentami medycyny. Zależało nam na tym, by urządzenie spełniało realne potrzeby branży - nie tylko od strony technicznej, ale i klinicznej.
          </p>
          <p className={`text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Przeczytaj opinie osób związanych z branżą medyczną - lekarzy, fizjoterapeutów i studentów - którzy przetestowali Rythmio w praktyce.
          </p>
          <button onClick={() => changeView('opinions')} className={`inline-flex items-center gap-2 font-semibold text-base sm:text-lg group transition-colors ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'}`}>
            Czytaj opinie
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className={`min-h-screen flex flex-col py-8 md:py-16 [@media(max-height:768px)]:py-6 border-t transition-colors duration-500 ${isDark ? 'bg-[#050505] border-white/5' : 'bg-[#f5f5f7] border-gray-200'}`} id="kontakt">
        <div className="flex-1 flex flex-col justify-center">
          <div className="max-w-4xl mx-auto px-6 text-center w-full">
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Czytasz to na konferencji?
            </h2>
            <p className={`text-xl sm:text-2xl font-semibold mb-12 sm:mb-16 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              Zagłosuj na nas!
            </p>

            <div className={`w-full h-px mb-12 sm:mb-16 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Chcesz z nami współpracować?
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Napisz do nas -{' '}
              <a
                href="mailto:rythmio.holter@gmail.com"
                className={`font-medium underline underline-offset-4 transition-colors ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'}`}
              >
                rythmio.holter@gmail.com
              </a>
            </p>
          </div>
        </div>
        <p className={`text-center text-[10px] sm:text-xs pb-6 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          © {new Date().getFullYear()} Rythmio. Wszelkie prawa zastrzeżone.
        </p>
      </section>

    </div>
  );
};

export default LandingPage;
