import { useTranslation } from 'react-i18next';
import { usePageScroll } from '../hooks/usePageScroll';

const initials = (name) =>
  name.split(' ').filter(w => /^[A-ZŁŚĄŻŹĆĘÓ]/.test(w)).slice(-2).map(w => w[0]).join('');

const OpinionsPage = ({ isDark, scrollbarStyles, onBack }) => {
  const { t } = useTranslation('opinions');
  const { t: tc } = useTranslation('common');
  const opinions = t('items', { returnObjects: true }).map((item, i) => ({ ...item, alt: i % 2 !== 0 }));
  const { containerRef, handleScroll } = usePageScroll(50, 0, true);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`h-screen overflow-y-auto scroll-smooth font-sans selection:bg-purple-500/30 transition-colors duration-500 ${isDark ? 'bg-black text-white' : 'bg-[#fdfdfd] text-slate-900'} ${scrollbarStyles}`}
    >
      {opinions.map((op, i) => (
        <section
          key={i}
          className={`min-h-screen flex flex-col justify-center py-20 [@media(max-height:768px)]:py-16 transition-colors duration-500 border-b ${
            op.alt
              ? isDark ? 'bg-[#050505] border-white/5' : 'bg-[#f5f5f7] border-gray-200'
              : isDark ? 'bg-black border-white/5'     : 'bg-[#fdfdfd] border-gray-200'
          }`}
        >
          <div className="max-w-3xl mx-auto px-6 w-full">
            <div className={`text-6xl sm:text-7xl font-serif leading-none select-none mb-6 ${isDark ? 'text-purple-500/40' : 'text-purple-400/50'}`}>&ldquo;</div>
              <p className={`text-lg sm:text-l lg:text-xl font-medium leading-relaxed mb-10 ${isDark ? 'text-gray-100' : 'text-slate-800'}`}>
                {op.quote}
              </p>
            {(op.name || op.role || op.org) && (
              <div className={`flex items-center gap-4 pt-6 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                {op.name && (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                    {initials(op.name)}
                  </div>
                )}
                <div>
                  {op.name && <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{op.name}</p>}
                  {(op.role || op.org) && (
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      {[op.role, op.org].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            )}
            {i === opinions.length - 1 && (
              <div className={`mt-10 pt-8 border-t text-center ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button onClick={onBack} className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                  {tc('nav.back')}
                </button>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
};

export default OpinionsPage;
