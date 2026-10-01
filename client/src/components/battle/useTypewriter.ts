import { useEffect, useState } from 'react';

/** Tempo por letra. O ritmo da batalha usa o mesmo valor para esperar a frase terminar. */
export const CHAR_MS = 22;

/**
 * Revela o texto letra a letra, como a caixa de diálogo do jogo. Com `instant`
 * (movimento reduzido) a frase aparece inteira na hora.
 */
export function useTypewriter(text: string, instant: boolean): { shown: string; done: boolean } {
  const [count, setCount] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const n = Math.min(text.length, Math.floor((now - start) / CHAR_MS) + 1);
      setCount(n);
      if (n < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, instant]);

  return { shown: text.slice(0, count), done: count >= text.length };
}
