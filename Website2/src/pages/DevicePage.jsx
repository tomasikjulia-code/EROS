import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers, Cpu, Activity, FileText, Mic, Battery,
  ChevronLeft, ChevronRight, Maximize2, X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePageScroll } from '../hooks/usePageScroll';

const GALLERY_SRCS = [
  '/images/prototyp.jpeg',
  '/images/lutowanie1.jpeg',
  '/images/lutowanie2.jpg',
  '/images/pcb1.jpeg',
  '/images/pcb2.jpeg',
  '/images/filmowiec.jpeg',
  '/images/dwieobudowy.jpg',
];

const ANATOMY_ICONS = [
  <Cpu />, <Activity />, <Activity />,
  <Activity />, <FileText />, <Mic />,
  <Battery />, <Layers />, <Activity />,
];

const DevicePage = ({ isDark, scrollbarStyles, onBack }) => {
  const { t } = useTranslation('device');
  const { t: tc } = useTranslation('common');
  const anatomyItems = t('anatomy.items', { returnObjects: true });
  const galleryTitles = t('gallery.images', { returnObjects: true });
  const galleryImages = GALLERY_SRCS.map((src, i) => ({ src, title: galleryTitles[i] }));
  const specRows = t('spec.rows', { returnObjects: true });
  const state1Items = t('interface.state1.items', { returnObjects: true });
  const state2Items = t('interface.state2.items', { returnObjects: true });
  const [maximizedIndex, setMaximizedIndex] = useState(null);
  const { containerRef, handleScroll, scrollNext, scrollPrev } = usePageScroll(50, 0, true);

  const galleryRef = useRef(null);
  const isGalleryDown = useRef(false);
  const startGalleryX = useRef(0);
  const scrollGalleryLeftPos = useRef(0);

  const scrollGalleryLeftBtn = () => galleryRef.current?.scrollBy({ left: -400, behavior: 'smooth' });
  const scrollGalleryRightBtn = () => galleryRef.current?.scrollBy({ left: 400, behavior: 'smooth' });

  const handleGalleryMouseDown = (e) => {
    isGalleryDown.current = true;
    startGalleryX.current = e.pageX - galleryRef.current.offsetLeft;
    scrollGalleryLeftPos.current = galleryRef.current.scrollLeft;
    galleryRef.current.classList.remove('scroll-smooth', 'snap-x', 'snap-mandatory');
  };
  const handleGalleryMouseLeave = () => {
    if (!isGalleryDown.current) return;
    isGalleryDown.current = false;
    galleryRef.current.classList.add('scroll-smooth', 'snap-x', 'snap-mandatory');
  };
  const handleGalleryMouseUp = () => {
    if (!isGalleryDown.current) return;
    isGalleryDown.current = false;
    galleryRef.current.classList.add('scroll-smooth', 'snap-x', 'snap-mandatory');
  };
  const handleGalleryMouseMove = (e) => {
    if (!isGalleryDown.current) return;
    e.preventDefault();
    const x = e.pageX - galleryRef.current.offsetLeft;
    const walk = (x - startGalleryX.current) * 1.5;
    galleryRef.current.scrollLeft = scrollGalleryLeftPos.current - walk;
  };

  return (
    <div ref={containerRef} onScroll={handleScroll} className={`h-screen overflow-y-auto scroll-smooth font-sans selection:bg-purple-500/30 transition-colors duration-500 ${isDark ? 'bg-black text-white' : 'bg-[#fdfdfd] text-slate-900'} ${scrollbarStyles}`}>


      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center pt-14 sm:pt-20 [@media(max-height:768px)]:pt-16 [@media(min-height:769px)_and_(max-height:900px)]:pt-14 overflow-hidden snap-start">
        <div className="relative z-10 flex flex-col items-center text-center px-6 w-full flex-1">
          <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] [@media(max-height:768px)]:text-4xl [@media(min-height:769px)_and_(max-height:900px)]:text-5xl font-semibold tracking-tighter mb-3 mt-6 [@media(max-height:768px)]:mt-2 [@media(max-height:768px)]:mb-2 [@media(min-height:769px)_and_(max-height:900px)]:mt-3 [@media(min-height:769px)_and_(max-height:900px)]:mb-2 transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('hero.title')}
          </h1>
          <div className="mb-8 sm:mb-12 [@media(max-height:768px)]:mb-3 [@media(min-height:769px)_and_(max-height:900px)]:mb-4 flex flex-col items-center">
            <p className={`text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] [@media(max-height:768px)]:text-4xl [@media(min-height:769px)_and_(max-height:900px)]:text-5xl font-semibold tracking-tighter mb-6 sm:mb-10 [@media(max-height:768px)]:mb-2 [@media(min-height:769px)_and_(max-height:900px)]:mb-4 transition-colors duration-500 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              {t('hero.highlight')}
            </p>
            <p className={`text-base sm:text-lg [@media(max-height:768px)]:text-sm font-normal transition-colors duration-500 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
              {t('hero.subtitle')}
            </p>
          </div>
          <div className="w-full max-w-4xl mx-auto flex-1 relative flex justify-center items-center mt-auto pb-6 sm:pb-12 [@media(max-height:768px)]:pb-3 [@media(min-height:769px)_and_(max-height:900px)]:pb-4">
            <div className={`relative z-10 mx-auto w-fit rounded-xl sm:rounded-2xl border-[6px] sm:border-[8px] overflow-hidden shadow-2xl ${isDark ? 'border-gray-900' : 'border-gray-100'}`}>
              <img src="/images/dev-pcb.jpg" alt={t('hero.img_alt')} className="block max-h-[45vh] sm:max-h-[55vh] [@media(max-height:768px)]:max-h-[52vh] [@media(min-height:769px)_and_(max-height:900px)]:max-h-[42vh] w-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Specyfikacja */}
      <section className={`min-h-screen flex flex-col justify-center py-8 md:py-14 [@media(max-height:768px)]:py-6 snap-start border-y transition-colors duration-500 ${isDark ? 'bg-[#050505] border-white/5' : 'bg-[#f5f5f7] border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 [@media(max-height:768px)]:gap-6 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl [@media(max-height:768px)]:text-3xl font-bold mb-6 [@media(max-height:768px)]:mb-3">{t('spec.title')}</h2>
              <p className={`text-base sm:text-lg [@media(max-height:768px)]:text-sm mb-8 [@media(max-height:768px)]:mb-4 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                {t('spec.desc')}
              </p>
              <div className={`rounded-2xl overflow-hidden border transition-colors duration-500 ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white shadow-sm'}`}>
                <div className={`px-4 py-3 border-b text-xs font-semibold tracking-widest uppercase ${isDark ? 'border-white/10 text-purple-400' : 'border-gray-200 text-purple-600'}`}>{t('spec.table_header')}</div>
                <table className="w-full text-sm">
                  <tbody>
                    {specRows.map(([param, val], i) => (
                      <tr key={i} className={`border-b last:border-b-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                        <td className={`px-4 py-3 [@media(max-height:768px)]:py-1.5 font-medium w-2/5 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>{param}</td>
                        <td className={`px-4 py-3 [@media(max-height:768px)]:py-1.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="relative">
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(147,51,234,0.25) 0%, rgba(99,102,241,0.15) 50%, transparent 70%)' }} />
              <img src="/images/pcb-opis.jpg" alt={t('spec.img_alt')} className={`relative z-10 w-full rounded-3xl border-[6px] sm:border-[8px] shadow-2xl ${isDark ? 'border-gray-900' : 'border-gray-100'}`} />
            </div>
          </div>
        </div>
      </section>

      {/* Anatomia */}
      <section className={`min-h-screen flex flex-col justify-center py-8 md:py-14 [@media(max-height:900px)]:py-5 [@media(max-height:768px)]:py-4 snap-start border-b transition-colors duration-500 ${isDark ? 'bg-black border-white/5' : 'bg-[#fdfdfd] border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="mb-6 md:mb-10 [@media(max-height:900px)]:mb-4 [@media(max-height:768px)]:mb-3">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl [@media(max-height:900px)]:text-3xl font-bold mb-2 [@media(max-height:900px)]:mb-1">{t('anatomy.title')}</h2>
            <p className={`text-base sm:text-lg [@media(max-height:900px)]:text-sm max-w-2xl leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              {t('anatomy.subtitle')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 [@media(max-height:900px)]:gap-3">
            {anatomyItems.map((item, i) => (
              <div key={i} className={`p-5 sm:p-6 [@media(max-height:900px)]:p-3 rounded-2xl border transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className={`w-10 h-10 [@media(max-height:900px)]:w-7 [@media(max-height:900px)]:h-7 rounded-xl flex items-center justify-center mb-4 [@media(max-height:900px)]:mb-2 ${isDark ? 'bg-white/5 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>{ANATOMY_ICONS[i]}</div>
                <h4 className="text-base [@media(max-height:900px)]:text-sm font-semibold mb-2 [@media(max-height:900px)]:mb-1">{item.title}</h4>
                <p className={`text-xs sm:text-sm [@media(max-height:900px)]:text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interfejs fizyczny */}
      <section className={`min-h-screen flex flex-col justify-center py-8 md:py-14 [@media(max-height:768px)]:py-6 snap-start border-y transition-colors duration-500 ${isDark ? 'bg-[#050505] border-white/5' : 'bg-[#f5f5f7] border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="text-center mb-6 md:mb-10 [@media(max-height:768px)]:mb-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">{t('interface.title')}</h2>
            <p className={`text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              {t('interface.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            <div className={`p-6 sm:p-8 rounded-2xl sm:rounded-3xl border transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`}>
              <span className={`inline-block px-3 py-1 mb-4 rounded-full text-xs font-semibold tracking-widest uppercase ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>{t('interface.state1.badge')}</span>
              <h3 className={`text-xl sm:text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('interface.state1.title')}</h3>
              <ul className="space-y-5">
                {state1Items.map((item, i) => (
                  <li key={i}>
                    <span className={`block text-xs font-semibold tracking-widest uppercase mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.label}:</span>
                    <span className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`p-6 sm:p-8 rounded-2xl sm:rounded-3xl border transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`}>
              <span className={`inline-block px-3 py-1 mb-4 rounded-full text-xs font-semibold tracking-widest uppercase ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>{t('interface.state2.badge')}</span>
              <h3 className={`text-xl sm:text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('interface.state2.title')}</h3>
              <ul className="space-y-5">
                {state2Items.map((item, i) => (
                  <li key={i}>
                    <span className={`block text-xs font-semibold tracking-widest uppercase mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.label}:</span>
                    <span className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Galeria */}
      <section className={`min-h-screen flex flex-col justify-center py-8 md:py-14 [@media(max-height:768px)]:py-3 [@media(min-height:769px)_and_(max-height:900px)]:py-5 border-y transition-colors duration-500 snap-start ${isDark ? 'bg-[#030303] border-white/5' : 'bg-[#fafafa] border-gray-200'}`} id="galeria">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-10 [@media(max-height:768px)]:mb-3 [@media(min-height:769px)_and_(max-height:900px)]:mb-4 gap-3 sm:gap-6">
            <div className="text-left max-w-2xl">
              <h2 className="text-3xl lg:text-4xl [@media(max-height:768px)]:text-2xl [@media(min-height:769px)_and_(max-height:900px)]:text-2xl font-bold mb-2 [@media(max-height:768px)]:mb-1 [@media(min-height:769px)_and_(max-height:900px)]:mb-1">{t('gallery.title')}</h2>
              <p className={`text-sm sm:text-base [@media(max-height:768px)]:text-xs [@media(min-height:769px)_and_(max-height:900px)]:text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{t('gallery.subtitle')}</p>
            </div>
            <div className="flex gap-4">
              <button onClick={scrollGalleryLeftBtn} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-slate-900'}`}><ChevronLeft size={24} /></button>
              <button onClick={scrollGalleryRightBtn} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-slate-900'}`}><ChevronRight size={24} /></button>
            </div>
          </div>
          <div
            ref={galleryRef}
            onMouseDown={handleGalleryMouseDown}
            onMouseLeave={handleGalleryMouseLeave}
            onMouseUp={handleGalleryMouseUp}
            onMouseMove={handleGalleryMouseMove}
            className="flex gap-4 sm:gap-8 overflow-x-auto snap-x snap-mandatory pb-8 [@media(max-height:768px)]:pb-4 [@media(min-height:769px)_and_(max-height:900px)]:pb-4 -mx-6 px-6 scroll-smooth cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {galleryImages.map((imgData, index) => (
              <div key={index} className={`group flex-shrink-0 w-[85vw] sm:w-[70vw] md:w-[600px] aspect-[4/3] [@media(max-height:768px)]:aspect-[16/9] [@media(min-height:769px)_and_(max-height:900px)]:aspect-[16/9] relative rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden snap-center transition-colors shadow-xl sm:shadow-2xl ${isDark ? 'border-[4px] sm:border-[6px] border-white/5 bg-[#111]' : 'border-[4px] sm:border-[6px] border-white bg-gray-100'}`}>
                <img src={imgData.src} alt={imgData.title} className="w-full h-full object-cover" draggable="false" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent flex items-end p-6 sm:p-8 pointer-events-none">
                  <h3 className="text-white text-lg sm:text-xl md:text-2xl font-semibold drop-shadow-md">{imgData.title}</h3>
                </div>
                <button onClick={() => setMaximizedIndex(index)} className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 sm:p-3 bg-black/40 backdrop-blur-md text-white rounded-full hover:bg-black/60 transition-all opacity-100 md:opacity-0 group-hover:opacity-100 z-20 cursor-pointer" title={t('gallery.zoom')}>
                  <Maximize2 size={20} className="sm:w-6 sm:h-6" />
                </button>
              </div>
            ))}
          </div>
          <div className={`mt-10 [@media(max-height:768px)]:mt-3 [@media(min-height:769px)_and_(max-height:900px)]:mt-4 pt-8 [@media(max-height:768px)]:pt-3 [@media(min-height:769px)_and_(max-height:900px)]:pt-4 border-t text-center ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
            <button onClick={onBack} className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
              {tc('nav.back')}
            </button>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {maximizedIndex !== null && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8" onClick={() => setMaximizedIndex(null)}>
          <button onClick={() => setMaximizedIndex(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 sm:p-3 bg-white/25 text-white rounded-full hover:bg-white/40 transition-all cursor-pointer"><X size={24} /></button>
          <button onClick={(e) => { e.stopPropagation(); setMaximizedIndex(prev => prev === 0 ? galleryImages.length - 1 : prev - 1); }} className="absolute left-2 sm:left-4 md:left-8 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all cursor-pointer"><ChevronLeft size={24} className="sm:w-8 sm:h-8" /></button>
          <button onClick={(e) => { e.stopPropagation(); setMaximizedIndex(prev => prev === galleryImages.length - 1 ? 0 : prev + 1); }} className="absolute right-2 sm:right-4 md:right-8 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all cursor-pointer"><ChevronRight size={24} className="sm:w-8 sm:h-8" /></button>
          <img src={galleryImages[maximizedIndex].src} alt={galleryImages[maximizedIndex].title} className="max-w-full max-h-[80vh] sm:max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} draggable="false" />
          <div className="absolute bottom-6 sm:bottom-8 left-0 right-0 text-center pointer-events-none px-12 sm:px-20">
            <h3 className="text-white text-base sm:text-xl md:text-3xl font-semibold drop-shadow-lg">{galleryImages[maximizedIndex].title}</h3>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DevicePage;
