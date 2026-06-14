import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Layers, Smartphone, Video, Users, MessageSquare } from 'lucide-react';
import LandingPage from './pages/LandingPage';
import DevicePage from './pages/DevicePage';
import DevPage from './pages/DevPage';
import VideoPage from './pages/VideoPage';
import AppPage from './pages/AppPage';
import AboutUsPage from './pages/AboutUsPage';
import OpinionsPage from './pages/OpinionsPage';

const VIEW_ORDER = ['landing', 'device', 'app', 'video', 'about-us', 'opinions', 'test'];

const PAGE_INFO = {
  device:     { label: 'Urządzenie', Icon: Layers,        transparent: false },
  app:        { label: 'Aplikacja',  Icon: Smartphone,    transparent: false },
  video:      { label: 'Wideo',      Icon: Video,         transparent: true  },
  'about-us': { label: 'O nas',      Icon: Users,         transparent: false },
  opinions:   { label: 'Opinie',     Icon: MessageSquare, transparent: false },
  test:       { label: '[TEST]',     Icon: Layers,        transparent: false },
};

function App() {
  const [viewData, setViewData] = useState(() => {
    const path = window.location.pathname.slice(1); // usuń '/'
    const view = VIEW_ORDER.includes(path) ? path : 'landing';
    return { view, key: 0, dir: 'none' };
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('rythmio-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const landingScrollPos = useRef(0);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('rythmio-theme', next);
  };

  const isDark = theme === 'dark';

  const changeView = (newView, dir = 'right') => {
    history.pushState({ view: newView }, '', newView === 'landing' ? '/' : '/' + newView);
    setIsAnimating(true);
    setViewData(prev => ({ view: newView, key: prev.key + 1, dir }));
    setMobileMenuOpen(false);
    setTimeout(() => setIsAnimating(false), 520);
  };

  useEffect(() => {
    const initialView = viewData.view;
    history.replaceState({ view: initialView }, '', initialView === 'landing' ? '/' : '/' + initialView);

    const onPopState = (e) => {
      const newView = e.state?.view ?? 'landing';
      setIsAnimating(true);
      setViewData(prev => {
        const dir = VIEW_ORDER.indexOf(newView) < VIEW_ORDER.indexOf(prev.view) ? 'left' : 'right';
        return { view: newView, key: prev.key + 1, dir };
      });
      setTimeout(() => setIsAnimating(false), 520);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollbarStyles = `[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full ${
    isDark
      ? '[&::-webkit-scrollbar-thumb]:bg-purple-500/40 [&::-webkit-scrollbar-thumb:hover]:bg-purple-500/70'
      : '[&::-webkit-scrollbar-thumb]:bg-purple-600/40 [&::-webkit-scrollbar-thumb:hover]:bg-purple-600/70'
  }`;

  const sharedProps = { isDark, onBack: () => changeView('landing', 'left'), scrollbarStyles };

  const animClass =
    viewData.dir === 'right' ? 'animate-slide-in-right' :
    viewData.dir === 'left'  ? 'animate-slide-in-left'  : '';

  const renderPage = () => {
    if (viewData.view === 'test')     return <DevPage {...sharedProps} changeView={changeView} />;
    if (viewData.view === 'device')   return <DevicePage {...sharedProps} />;
    if (viewData.view === 'video')    return <VideoPage {...sharedProps} />;
    if (viewData.view === 'app')      return <AppPage {...sharedProps} />;
    if (viewData.view === 'about-us') return <AboutUsPage {...sharedProps} />;
    if (viewData.view === 'opinions') return <OpinionsPage {...sharedProps} />;
    return (
      <LandingPage
        isDark={isDark}
        toggleTheme={toggleTheme}
        changeView={changeView}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        scrollbarStyles={scrollbarStyles}
        scrollMemory={landingScrollPos}
      />
    );
  };

  const pageInfo = PAGE_INFO[viewData.view];

  return (
    <>
      {pageInfo && (
        <nav className={`fixed w-full z-[60] top-0 border-b transition-colors duration-500 ${pageInfo.transparent ? 'bg-transparent border-transparent backdrop-blur-none' : `backdrop-blur-md ${isDark ? 'bg-[#1d1d1f]/80 border-white/10' : 'bg-white/80 border-gray-200'}`} ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <button onClick={() => changeView('landing', 'left')} className={`flex items-center gap-2 text-sm sm:text-base font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              <ArrowLeft size={20} /><span>Wróć do strony głównej</span>
            </button>
            <div className="flex items-center gap-2 opacity-50">
              <pageInfo.Icon size={20} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
              <span className="hidden sm:inline text-sm font-semibold tracking-wide uppercase">{pageInfo.label}</span>
            </div>
          </div>
        </nav>
      )}
      <div className={`fixed inset-0 overflow-hidden transition-colors duration-500 ${isDark ? 'bg-black' : 'bg-white'}`}>
        <div key={viewData.key} className={`h-full ${animClass} transition-colors duration-500 ${isDark ? 'bg-black' : 'bg-white'}`} {...(isAnimating ? { 'data-animating': '' } : {})}>
          {renderPage()}
        </div>
      </div>
    </>
  );
}

export default App;
