import { cn } from '../utils/cn';
import { XP_THRESHOLDS, derivedStage } from '../data/pokedex';
import type { TrainerProgress } from '../types';

/**
 * Fração preenchida do segmento ATUAL (do limiar do estágio corrente até o
 * próximo), não do total. É o que faz a barra ter o mesmo significado em
 * qualquer estágio.
 */
export function segmentFraction(progress: TrainerProgress): number {
  if (progress.nextXp === null) return 1;
  const stage = Math.min(derivedStage(progress.xp), progress.maxStage);
  const floor = XP_THRESHOLDS[stage] ?? 0;
  const span = progress.nextXp - floor;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (progress.xp - floor) / span));
}

export function XpBar({
  progress,
  className,
}: {
  progress: TrainerProgress;
  className?: string;
}) {
  const fraction = segmentFraction(progress);
  const done = progress.nextXp === null;
  return (
    <div
      className={cn('h-1 w-full rounded-full bg-surface-4 overflow-hidden', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out',
          done ? 'bg-highlight' : 'bg-brand',
        )}
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}

/** Pips do estágio. Discreto de propósito — o tema Pokémon é uma camada sutil. */
export function StagePips({
  progress,
  className,
}: {
  progress: TrainerProgress;
  className?: string;
}) {
  const total = progress.maxStage + 1;
  return (
    <span className={cn('inline-flex items-center gap-[3px]', className)} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'w-1 h-1 rounded-full transition-colors',
            i <= progress.stage ? 'bg-highlight' : 'bg-surface-4',
          )}
        />
      ))}
    </span>
  );
}

/** "faltam 12 XP" / "no máximo". */
export function xpCaption(progress: TrainerProgress): string {
  if (progress.nextXp === null) return 'estágio final';
  return `faltam ${Math.max(0, progress.nextXp - progress.xp)} XP`;
}
