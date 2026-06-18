import { useTranslation } from 'react-i18next';
import { usePageScroll } from '../hooks/usePageScroll';

const VideoPage = ({ isDark, scrollbarStyles, onBack }) => {
  const { t } = useTranslation('common');
  const { containerRef, handleScroll } = usePageScroll(50, 0);

  return (
    <div ref={containerRef} onScroll={handleScroll} className={`h-screen overflow-y-auto scroll-smooth font-sans selection:bg-purple-500/30 transition-colors duration-500 ${isDark ? 'bg-black text-white' : 'bg-[#fdfdfd] text-slate-900'} ${scrollbarStyles}`}>


      <section className="relative min-h-screen flex flex-col items-center justify-start pt-20 sm:justify-center sm:pt-20 md:pt-24 pb-8 px-4 sm:px-6">
        {/* Tytuł – wąski */}
        <div className="relative z-10 text-center mb-6 sm:mb-8 w-full max-w-2xl">
          <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tighter transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('video.title')}
          </h1>
        </div>

        {/* Video – szeroki na desktopie */}
        <div className="relative z-10 w-full max-w-[95vw] md:max-w-[92vw] lg:max-w-[88vw] xl:max-w-[1400px]">
          <div className="relative">
            {/* glow */}
            <div className={`absolute -inset-4 rounded-3xl blur-3xl -z-10 ${isDark ? 'bg-purple-600/15' : 'bg-purple-400/10'}`} />
            <div
              className="w-full aspect-video relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-[4px] sm:border-[6px] transition-colors duration-500"
              style={{ borderColor: isDark ? '#111' : '#ebebeb' }}
            >
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&controls=1&rel=0"
                title="Rythmio Video"
                frameBorder="0"
                allowFullScreen
              />
            </div>
          </div>
        </div>
        <div className={`mt-8 pt-6 border-t text-center ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
          <button onClick={onBack} className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
            {t('nav.back')}
          </button>
        </div>
      </section>

    </div>
  );
};

export default VideoPage;
