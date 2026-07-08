import React, { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const cursorDotRef = useRef(null);
  const cursorRingRef = useRef(null);
  const pos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const raf = useRef(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Hide system cursor globally
    document.documentElement.style.cursor = 'none';

    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
    };

    // Lerp ring to follow dot smoothly
    const animate = () => {
      ringPos.current.x += (pos.current.x - ringPos.current.x) * 0.12;
      ringPos.current.y += (pos.current.y - ringPos.current.y) * 0.12;

      if (cursorDotRef.current) {
        cursorDotRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
      }
      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px)`;
      }
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);

    // Expand on interactive elements
    const expandTargets = 'a, button, [role="button"], input, textarea, select, .podcast-card, .glass-panel, .nav-link';

    const onEnter = (e) => {
      if (e.target.closest(expandTargets)) setExpanded(true);
    };
    const onLeave = (e) => {
      if (e.target.closest(expandTargets)) setExpanded(false);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onEnter);
    document.addEventListener('mouseout', onLeave);

    return () => {
      document.documentElement.style.cursor = '';
      cancelAnimationFrame(raf.current);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onEnter);
      document.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return (
    <>
      {/* Dot — snaps instantly */}
      <div
        ref={cursorDotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: expanded ? '10px' : '8px',
          height: expanded ? '10px' : '8px',
          background: 'var(--color-primary)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 999999,
          marginLeft: expanded ? '-5px' : '-4px',
          marginTop: expanded ? '-5px' : '-4px',
          boxShadow: `0 0 ${expanded ? '14px' : '8px'} var(--color-primary)`,
          transition: 'width 0.2s ease, height 0.2s ease, box-shadow 0.2s ease',
          willChange: 'transform',
        }}
      />
      {/* Ring — lags behind smoothly */}
      <div
        ref={cursorRingRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: expanded ? '44px' : '28px',
          height: expanded ? '44px' : '28px',
          border: `1.5px solid var(--color-primary)`,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 999998,
          marginLeft: expanded ? '-22px' : '-14px',
          marginTop: expanded ? '-22px' : '-14px',
          opacity: expanded ? 0.6 : 0.45,
          boxShadow: expanded ? `0 0 20px rgba(var(--spot-rgb), 0.3)` : 'none',
          transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1), height 0.25s cubic-bezier(0.16,1,0.3,1), margin 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease, box-shadow 0.2s ease',
          willChange: 'transform',
        }}
      />
    </>
  );
}
