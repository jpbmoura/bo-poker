import { useMemo } from 'react';
import { cn } from '../utils/cn';

interface ConfettiProps {
  active: boolean;
  count?: number;
  duration?: number;
}

interface Particle {
  left: number;
  delay: number;
  fall: number;
  drift: number;
  rotateStart: number;
  rotateEnd: number;
  size: number;
  variant: 'pokeball' | 'star' | 'dot';
  color: string;
}

const COLORS = [
  'var(--brand)',
  'var(--highlight)',
  'var(--success)',
  '#FFFFFF',
];

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function Confetti({ active, count = 36, duration = 2400 }: ConfettiProps) {
  const particles = useMemo<Particle[]>(() => {
    if (!active) return [];
    return Array.from({ length: count }).map(() => ({
      left: rand(0, 100),
      delay: rand(0, 400),
      fall: rand(1400, 2400),
      drift: rand(-80, 80),
      rotateStart: rand(0, 360),
      rotateEnd: rand(360, 1080) * (Math.random() < 0.5 ? -1 : 1),
      size: rand(8, 16),
      variant: pickVariant(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }, [active, count]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden="true"
      style={{ animation: `confetti-cleanup 1ms linear ${duration}ms forwards` }}
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-30px] block"
          style={
            {
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animation: `confetti-fall ${p.fall}ms cubic-bezier(0.25, 0.6, 0.5, 1) ${p.delay}ms forwards`,
              ['--drift' as string]: `${p.drift}px`,
              ['--r0' as string]: `${p.rotateStart}deg`,
              ['--r1' as string]: `${p.rotateEnd}deg`,
            } as React.CSSProperties
          }
        >
          <Particle variant={p.variant} color={p.color} size={p.size} />
        </span>
      ))}
    </div>
  );
}

function pickVariant(): Particle['variant'] {
  const r = Math.random();
  if (r < 0.45) return 'pokeball';
  if (r < 0.75) return 'star';
  return 'dot';
}

function Particle({
  variant,
  color,
  size,
}: {
  variant: Particle['variant'];
  color: string;
  size: number;
}) {
  if (variant === 'pokeball') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <circle cx="12" cy="12" r="10" fill={color === 'var(--brand)' ? color : '#FFFFFF'} />
        <path
          d="M2 12h20"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="2"
        />
        <path
          d="M2 12 A10 10 0 0 1 22 12"
          fill={color === 'var(--brand)' ? color : 'var(--brand)'}
        />
        <circle cx="12" cy="12" r="2.6" fill="#FFFFFF" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
      </svg>
    );
  }
  if (variant === 'star') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
        <path d="M12 2 L14.5 9 L22 9.3 L16 14 L18 21.5 L12 17.5 L6 21.5 L8 14 L2 9.3 L9.5 9 Z" />
      </svg>
    );
  }
  return (
    <span
      className={cn('block w-full h-full rounded-full')}
      style={{ background: color }}
    />
  );
}
