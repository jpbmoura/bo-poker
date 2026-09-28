import { cn } from '../utils/cn';
import { PokeballIcon } from './ui/PokeballIcon';
import { StagePips, XpBar, xpCaption } from './TrainerProgressBits';
import type { TrainerPokemon } from '../services/trainer';

interface TrainerBadgeProps {
  /**
   * UM Pokémon — e não "o Pokémon do usuário". A assinatura evita assumir
   * unicidade, para o dia em que a conta tiver vários e este badge virar item
   * de lista.
   */
  pokemon: TrainerPokemon | null;
  compact?: boolean;
  className?: string;
}

export function TrainerBadge({ pokemon, compact = false, className }: TrainerBadgeProps) {
  if (!pokemon) {
    return (
      <div className={cn('flex items-center gap-2 text-subtle', className)}>
        <PokeballIcon size={16} />
        <span className="text-xs">sem Pokémon</span>
      </div>
    );
  }

  const { form, progress } = pokemon;

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <img
        src={form.sprite}
        alt=""
        className={cn('object-contain shrink-0', compact ? 'w-8 h-8' : 'w-10 h-10')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-text capitalize',
              compact ? 'text-xs' : 'text-sm font-medium',
            )}
          >
            {form.name}
          </span>
          <StagePips progress={progress} />
        </div>
        <XpBar progress={progress} className="mt-1.5" />
        <div className="mt-1 text-[11px] font-mono text-subtle truncate">
          {progress.xp} XP · {xpCaption(progress)}
        </div>
      </div>
    </div>
  );
}
