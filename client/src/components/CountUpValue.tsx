import { useEffect, useState } from 'react';
import { animate, useMotionValue } from 'framer-motion';

interface CountUpValueProps {
  value: string | null;
  active: boolean;
  delayMs?: number;
  durationMs?: number;
}

const NON_NUMERIC = new Set(['?', null, undefined, '']);

export function CountUpValue({
  value,
  active,
  delayMs = 0,
  durationMs = 360,
}: CountUpValueProps) {
  const motion = useMotionValue(0);
  const [display, setDisplay] = useState<string>('—');

  useEffect(() => {
    if (!active) {
      setDisplay('—');
      motion.set(0);
      return;
    }

    if (value === null || value === undefined || value === '') {
      setDisplay('—');
      return;
    }

    if (NON_NUMERIC.has(value)) {
      setDisplay(String(value));
      return;
    }

    const target = Number(value);
    if (Number.isNaN(target)) {
      setDisplay(String(value));
      return;
    }

    let cancelled = false;
    motion.set(0);
    setDisplay('0');

    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      const unsub = motion.on('change', (latest) => {
        setDisplay(String(Math.round(latest)));
      });
      const controls = animate(motion, target, {
        duration: durationMs / 1000,
        ease: [0.22, 1, 0.36, 1],
        onComplete: () => setDisplay(String(target)),
      });
      // store cleanup
      cleanupRef = () => {
        unsub();
        controls.stop();
      };
    }, delayMs);

    let cleanupRef: (() => void) | null = null;
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      cleanupRef?.();
    };
  }, [active, value, delayMs, durationMs, motion]);

  return <>{display}</>;
}
