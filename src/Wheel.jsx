import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A vertical scroll wheel. The item in the center is the selection.
// `smooth` animates changes that come from outside (like Surprise me).
export default function Wheel({ label, idBase = label, options, value, onChange, overridden = false, smooth = false }) {
  const listRef = useRef(null);
  const frame = useRef(0);
  const settleTimer = useRef(0);
  const userActive = useRef(false); // true while the player is spinning this wheel
  const fromScroll = useRef(null); // index the player just scrolled to

  const selectedIndex = Math.max(0, options.findIndex((o) => o.part === value));
  const [centerIndex, setCenterIndex] = useState(selectedIndex);
  const latestIndex = useRef(selectedIndex);
  latestIndex.current = selectedIndex;

  const markUser = () => {
    userActive.current = true;
  };

  const itemHeight = () => listRef.current?.firstElementChild?.offsetHeight || 1;

  const indexAtCenter = () => {
    const list = listRef.current;
    if (!list) return latestIndex.current;
    return Math.min(options.length - 1, Math.max(0, Math.round(list.scrollTop / itemHeight())));
  };

  const scrollToIndex = (i, animate) => {
    listRef.current?.scrollTo({
      top: i * itemHeight(),
      behavior: animate && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
  };

  // Follow value changes that didn't come from spinning this wheel.
  useLayoutEffect(() => {
    if (fromScroll.current === selectedIndex) {
      fromScroll.current = null;
      return;
    }
    scrollToIndex(selectedIndex, smooth);
    if (!smooth || prefersReducedMotion()) setCenterIndex(selectedIndex);
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-center when the wheel's width changes (resizes, switching tabs).
  useEffect(() => {
    const list = listRef.current;
    if (!list || !('ResizeObserver' in window)) return;
    let lastWidth = list.clientWidth;
    const ro = new ResizeObserver(() => {
      if (list.clientWidth === lastWidth) return;
      lastWidth = list.clientWidth;
      scrollToIndex(latestIndex.current, false);
      setCenterIndex(latestIndex.current);
    });
    ro.observe(list);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // Only scrolling the player caused changes the selection. Scrolls the
  // browser causes on its own (resizes, layout shifts) are undone.
  const handleScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const i = indexAtCenter();
      setCenterIndex(i);
      if (userActive.current && i !== latestIndex.current) {
        fromScroll.current = i;
        onChange(options[i].part);
      }
    });

    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!userActive.current && indexAtCenter() !== latestIndex.current) {
        scrollToIndex(latestIndex.current, false);
        setCenterIndex(latestIndex.current);
      }
      userActive.current = false;
    }, 150);
  };

  const handleKeyDown = (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      markUser();
      scrollToIndex(e.key === 'Home' ? 0 : options.length - 1, true);
    } else if (step) {
      e.preventDefault();
      markUser();
      scrollToIndex(Math.min(options.length - 1, Math.max(0, centerIndex + step)), true);
    }
  };

  const optionId = (i) => `${idBase}-option-${i}`;

  return (
    <div className={`wheel ${overridden ? 'is-overridden' : ''}`}>
      <div
        ref={listRef}
        className="wheel-list"
        role="listbox"
        tabIndex={0}
        aria-label={`Choose a ${label}`}
        aria-activedescendant={optionId(centerIndex)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onWheel={markUser}
        onTouchStart={markUser}
        onPointerDown={markUser}
      >
        {options.map((opt, i) => {
          const distance = Math.abs(i - centerIndex);
          const state = distance === 0 ? 'is-center' : distance === 1 ? 'is-near' : 'is-far';
          return (
            <div
              key={opt.part || 'none'}
              id={optionId(i)}
              role="option"
              aria-selected={distance === 0}
              className={`wheel-item ${state} ${opt.part ? '' : 'is-none'}`}
              onClick={() => {
                markUser();
                scrollToIndex(i, true);
              }}
            >
              {opt.part || 'none'}
            </div>
          );
        })}
      </div>
    </div>
  );
}
