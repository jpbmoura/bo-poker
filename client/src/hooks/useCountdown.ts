import { useEffect, useState } from 'react';

/** "hh:mm:ss" até `iso`. Quando zera, chama `onZero` (pedir o Pokémon novo). */
export function useCountdown(iso: string | undefined, onZero: () => void): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = iso ? Math.max(0, new Date(iso).getTime() - now) : 0;
  const zero = iso !== undefined && left === 0;
  useEffect(() => {
    if (zero) onZero();
  }, [zero, onZero]);
  const s = Math.floor(left / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
