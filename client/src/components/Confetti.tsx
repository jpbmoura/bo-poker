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
        particleCount: 70,
        angle,
        spread: 75,
        origin,
        colors: COLORS,
        shapes: ['circle', 'square', 'star'],
        scalar: 1.1,
        ticks: 300,
        startVelocity: 55,
        gravity: 1.05,
      });

    const burstCenter = () =>
      fire({
        particleCount: 90,
        angle: 90,
        spread: 130,
        origin: { x: 0.5, y: 0.45 },
        colors: COLORS,
        shapes: ['star', 'circle'],
        scalar: 1.4,
        ticks: 340,
        startVelocity: 38,
        gravity: 0.85,
      });

    burstSide({ x: 0.08, y: 0.85 }, 60);
    burstSide({ x: 0.92, y: 0.85 }, 120);
    const t1 = window.setTimeout(burstCenter, 180);
    const t2 = window.setTimeout(() => {
      burstSide({ x: 0.18, y: 0.9 }, 65);
      burstSide({ x: 0.82, y: 0.9 }, 115);
    }, 460);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
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
