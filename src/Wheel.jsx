import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A vertical scroll wheel. The item in the center is the selection.
// `smooth` animates changes that come from outside (like Surprise me).
export default function Wheel({ label, idBase = label, options, value, onChange, smooth = false }) {
  const listRef = useRef(null);
  const frame = useRef(0);
  const settleTimer = useRef(0);
  const verifyTimer = useRef(0);
  const touching = useRef(false); // a finger is on the wheel
  const lastUserAt = useRef(0); // when the player last touched, clicked, or scrolled this wheel
  const fromScroll = useRef(null); // index the player just scrolled to

  const selectedIndex = Math.max(0, options.findIndex((o) => o.part === value));
  const [centerIndex, setCenterIndex] = useState(selectedIndex);
  const latestIndex = useRef(selectedIndex);
  latestIndex.current = selectedIndex;

  const markUser = () => {
    lastUserAt.current = Date.now();
  };

  // Scrolling counts as the player's while their finger is down, and for a
  // moment after, which covers momentum scrolling and the final snap on phones.
  const USER_WINDOW_MS = 1200;
  const isUserScroll = () => touching.current || Date.now() - lastUserAt.current < USER_WINDOW_MS;

  const commit = (i) => {
    if (i !== latestIndex.current) {
      fromScroll.current = i;
      onChange(options[i].part);
    }
  };

  // The exact row height, fractions of a pixel included. (offsetHeight rounds
  // to whole pixels, and on a long wheel that rounding adds up until the
  // highlight lands a row away from where the wheel actually stopped.)
  const itemHeight = () => {
    const first = listRef.current?.firstElementChild;
    if (!first) return 1;
    return parseFloat(getComputedStyle(first).height) || first.offsetHeight || 1;
  };

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

  useEffect(
    () => () => {
      clearTimeout(settleTimer.current);
      clearTimeout(verifyTimer.current);
    },
    []
  );

  // The wheel's position is the truth: the highlighted part and the selection
  // always end up matching what's actually in the middle.
  const handleScroll = () => {
    const user = isUserScroll();
    if (user) markUser(); // keep the window open while momentum carries on

    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const i = indexAtCenter();
      setCenterIndex(i);
      if (user) commit(i);
    });

    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const i = indexAtCenter();
      if (i === latestIndex.current) {
        setCenterIndex(i);
        return;
      }
      if (isUserScroll()) {
        // The player's scroll came to rest here.
        setCenterIndex(i);
        commit(i);
        return;
      }
      // A scroll the player didn't cause (a resize or layout shift): move back.
      scrollToIndex(latestIndex.current, false);
      clearTimeout(verifyTimer.current);
      verifyTimer.current = setTimeout(() => {
        // Some phones ignore that move mid-scroll. If so, accept where the wheel is.
        const j = indexAtCenter();
        setCenterIndex(j);
        commit(j);
      }, 250);
    }, 250);
  };

  const handleTouchStart = () => {
    touching.current = true;
    markUser();
  };

  const handleTouchEnd = () => {
    touching.current = false;
    markUser();
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
    <div className="wheel">
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
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
