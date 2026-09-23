import { useLayoutEffect, useState } from 'react';

// A starburst of rays and confetti that shoots out from the edges of the
// result card when someone makes up a brand-new word.
const COLORS = ['#e8f8f1', '#f5d97a', '#c2785a', '#74c1ab', '#ffffff'];
const RAYS = 22;
const BITS = 14;

// Distance from the card's center to its edge in a given direction (0deg = straight up).
function edgeDistance(angle, halfWidth, halfHeight) {
  const rad = (angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  return Math.min(sin ? halfWidth / sin : Infinity, cos ? halfHeight / cos : Infinity);
}

export default function Burst({ cardRef }) {
  const [pieces, setPieces] = useState([]);

  useLayoutEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const card = cardRef.current;
    if (!card) return;
    const w = card.offsetWidth / 2;
    const h = card.offsetHeight / 2;

    const rays = Array.from({ length: RAYS }, (_, i) => {
      const angle = (360 / RAYS) * i + (Math.random() * 6 - 3);
      const edge = edgeDistance(angle, w, h);
      const long = i % 2 === 0;
      return {
        kind: 'ray',
        angle,
        from: edge - 12,
        to: edge + (long ? 80 : 50),
        len: long ? 28 : 16,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 90,
      };
    });

    const bits = Array.from({ length: BITS }, (_, i) => {
      const angle = Math.random() * 360;
      const edge = edgeDistance(angle, w, h);
      return {
        kind: 'bit',
        angle,
        from: edge - 6,
        to: edge + 90 + Math.random() * 60,
        size: 7 + Math.random() * 6,
        spin: Math.random() * 360 - 180,
        color: COLORS[(i + 2) % COLORS.length],
        delay: 60 + Math.random() * 140,
      };
    });

    setPieces([...rays, ...bits]);
  }, [cardRef]);

  return (
    <div className="burst" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`burst-${p.kind}`}
          style={{
            '--a': `${p.angle}deg`,
            '--from': `${p.from}px`,
            '--to': `${p.to}px`,
            '--len': `${p.len || p.size}px`,
            '--size': `${p.size || 6}px`,
            '--spin': `${p.spin || 0}deg`,
            '--c': p.color,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}
