import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  active: boolean;
}

const COLORS = ['#ef4444', '#f5f5f4', '#f59e0b', '#fbbf24', '#fde68a'];

export function Confetti({ active }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fireRef = useRef<confetti.CreateTypes | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    fireRef.current = confetti.create(canvasRef.current, {
      resize: true,
      useWorker: true,
    });
    return () => {
      fireRef.current?.reset();
      fireRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!active || !fireRef.current) return;
    const fire = fireRef.current;

    const burstSide = (origin: { x: number; y: number }, angle: number) =>
      fire({
        particleCount: 40,
        angle,
        spread: 70,
        origin,
        colors: COLORS,
        shapes: ['circle', 'square'],
        scalar: 1.1,
        ticks: 240,
        startVelocity: 55,
        gravity: 1.1,
      });

    const burstCenter = () =>
      fire({
        particleCount: 50,
        angle: 90,
        spread: 120,
        origin: { x: 0.5, y: 0.45 },
        colors: COLORS,
        shapes: ['star', 'circle'],
        scalar: 1.3,
        ticks: 260,
        startVelocity: 38,
        gravity: 0.9,
      });

    burstSide({ x: 0.08, y: 0.85 }, 60);
    burstSide({ x: 0.92, y: 0.85 }, 120);
    const t1 = window.setTimeout(burstCenter, 180);

    return () => {
      window.clearTimeout(t1);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 w-full h-full"
    />
  );
}
