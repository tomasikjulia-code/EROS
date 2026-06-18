import { useTranslation } from 'react-i18next';

const VideoPage = ({ isDark, onBack }) => {
  const { t } = useTranslation('common');

  return (
    <div className={`h-screen overflow-hidden flex flex-col font-sans selection:bg-purple-500/30 transition-colors duration-500 ${isDark ? 'bg-black text-white' : 'bg-[#fdfdfd] text-slate-900'}`}>

      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-16 pb-6 gap-4 sm:gap-6">
        {/* Tytuł */}
        <div className="text-center w-full max-w-2xl">
          <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tighter transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
                src="https://www.youtube.com/embed/CSdLehhHmIk"
                title="Rythmio Video"
                frameBorder="0"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      <div className="pb-6 text-center">
        <button onClick={onBack} className={`text-sm font-medium transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
          {t('nav.back')}
        </button>
      </div>

    </div>
  );
};

export default VideoPage;
