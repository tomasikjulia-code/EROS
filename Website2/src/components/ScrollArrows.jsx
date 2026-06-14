import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Globalne strzałki nawigacji między sekcjami (ukryte na mobile).
 */
const ScrollArrows = ({ isDark, isScrolled, isAtBottom, onScrollPrev, onScrollNext }) => (
  <>
    <div
      onClick={onScrollPrev}
      className={`hidden md:flex fixed top-24 left-1/2 -translate-x-1/2 flex-col items-center gap-2 cursor-pointer transition-opacity duration-500 z-40 ${
        isScrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <ChevronUp
        size={32}
        className={`animate-bounce drop-shadow-md transition-colors ${
          isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'
        }`}
      />
    </div>

    <div
      onClick={onScrollNext}
      className={`hidden md:flex fixed bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 cursor-pointer transition-opacity duration-500 z-40 ${
        isAtBottom ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <ChevronDown
        size={32}
        className={`animate-bounce drop-shadow-md transition-colors ${
          isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'
        }`}
      />
    </div>
  </>
);

export default ScrollArrows;
