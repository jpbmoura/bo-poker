import type { FighterOption } from '../../services/capture';
import type { TrainerPokemon } from '../../services/trainer';
import { cn } from '../../utils/cn';
import { TYPE_COLOR, TYPE_LABEL } from './labels';

interface PokemonPickerProps {
  pokemon: TrainerPokemon[];
  options: FighterOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function matchup(o: FighterOption): { text: string; tone: 'good' | 'bad' | 'none' } | null {
  if (o.attack > 1 && o.defense <= 1) return { text: '▲ Vantagem de tipo', tone: 'good' };
  if (o.defense > 1 && o.attack <= 1) return { text: '▼ Desvantagem de tipo', tone: 'bad' };
  if (o.attack > 1 && o.defense > 1) return { text: '◆ Vantagem dos dois lados', tone: 'none' };
  return null;
}

/** A coleção como os slots do menu de party: sprite, nome, nível, tipos e confronto. */
export function PokemonPicker({ pokemon, options, selectedId, onSelect }: PokemonPickerProps) {
  const byId = new Map(options.map((o) => [o.pokemonId, o]));

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Escolha quem vai lutar">
      {pokemon.map((p) => {
        const o = byId.get(p.id);
        if (!o) return null;
        const m = matchup(o);
        const selected = p.id === selectedId;
        return (
          <li key={p.id}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(p.id)}
              className={cn(
                'gba-slot w-full flex items-center gap-2.5 py-1.5 pl-1.5 pr-3 text-left outline-none',
                'transition-[background-color,border-color,transform] duration-fast',
                'focus-visible:ring-2 focus-visible:ring-highlight/70',
                selected
                  ? 'border-highlight bg-highlight-soft -translate-y-0.5'
                  : 'border-border-strong bg-surface-2 hover:bg-surface-3',
              )}
            >
              <div
                className={cn(
                  'relative w-14 h-14 shrink-0 rounded-md',
                  selected ? 'bg-highlight/15' : 'bg-black/20',
                )}
              >
                <img
                  src={p.form.sprite}
                  alt=""
                  className={cn(
                    'w-full h-full object-contain [image-rendering:pixelated]',
                    selected && 'motion-safe:animate-idle-bob',
                  )}
                  draggable={false}
                />
              </div>
              <div className="min-w-0 flex-1 font-pixel">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-base font-semibold text-text leading-tight truncate">{p.form.name}</p>
                  <span className="text-sm text-muted shrink-0">
                    <span className="text-[10px]">Nv</span>
                    {o.level}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-x-2 text-[11px] leading-none">
                  {o.types.map((t) => (
                    <span key={t} className="font-semibold uppercase" style={{ color: TYPE_COLOR[t] }}>
                      {TYPE_LABEL[t]}
                    </span>
                  ))}
                </div>
                {m && (
                  <p
                    className={cn(
                      'mt-1 text-[11px] leading-none',
                      m.tone === 'good' && 'text-success',
                      m.tone === 'bad' && 'text-danger',
                      m.tone === 'none' && 'text-muted',
                    )}
                  >
                    {m.text}
                  </p>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
