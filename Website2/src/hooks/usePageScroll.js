import { useState, useRef, useEffect } from 'react';

/**
 * Wspólny hook obsługujący logikę przewijania dla stron aplikacji.
 * @param {number}  scrolledThreshold - próg scrollTop (px) uznawany za "przewinięty"
 * @param {number}  initialScrollTop  - początkowa pozycja scrolla (do inicjalizacji isScrolled)
 * @param {boolean} snapOnDesktop     - włącza snap między sekcjami na desktopie (≥1024px)
 */
export const usePageScroll = (scrolledThreshold = 50, initialScrollTop = 0, snapOnDesktop = false) => {
  const [isScrolled, setIsScrolled] = useState(initialScrollTop > scrolledThreshold);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const containerRef = useRef(null);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setIsScrolled(scrollTop > scrolledThreshold);
    setIsAtBottom(Math.ceil(scrollTop + clientHeight) >= scrollHeight - 100);
  };

  const scrollNext = () => {
    if (!containerRef.current) return;
    const sections = Array.from(containerRef.current.querySelectorAll('section'));
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const nextSection = sections.find(
      (sec) => sec.getBoundingClientRect().top - containerTop > 50
    );
    if (nextSection) nextSection.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollPrev = () => {
    if (!containerRef.current) return;
    const sections = Array.from(containerRef.current.querySelectorAll('section'));
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const prevSection = [...sections]
      .reverse()
      .find((sec) => sec.getBoundingClientRect().top - containerTop < -50);
    if (prevSection) prevSection.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!snapOnDesktop) return;
    const el = containerRef.current;
    if (!el) return;

    const isSnapping = { current: false };
    let snapTimer = null;

    const lockSnap = () => {
      isSnapping.current = true;
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => { isSnapping.current = false; }, 750);
    };

    const getSections = () => Array.from(el.querySelectorAll('section'));

    const getCurrentIdx = (sections) => {
      let best = 0;
      sections.forEach((sec, i) => {
        if (sec.offsetTop <= el.scrollTop + 10) best = i;
      });
      return best;
    };

    const onWheel = (e) => {
      if (window.innerWidth < 1024) return;
      if (isSnapping.current) { e.preventDefault(); return; }
      e.preventDefault();
      const sections = getSections();
      const idx = getCurrentIdx(sections);
      const next = Math.max(0, Math.min(idx + (e.deltaY > 0 ? 1 : -1), sections.length - 1));
      el.scrollTo({ top: sections[next].offsetTop, behavior: 'smooth' });
      lockSnap();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(snapTimer);
    };
  }, [snapOnDesktop]);

  return { isScrolled, isAtBottom, containerRef, handleScroll, scrollNext, scrollPrev };
};
