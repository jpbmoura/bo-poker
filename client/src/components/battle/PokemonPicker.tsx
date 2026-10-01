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
  if (o.attack > 1 && o.defense <= 1) return { text: 'Vantagem de tipo', tone: 'good' };
  if (o.defense > 1 && o.attack <= 1) return { text: 'Desvantagem de tipo', tone: 'bad' };
  if (o.attack > 1 && o.defense > 1) return { text: 'Os dois têm vantagem', tone: 'none' };
  return null;
}

/** Lista a coleção com o que importa para a escolha: nível, tipos e confronto. */
export function PokemonPicker({ pokemon, options, selectedId, onSelect }: PokemonPickerProps) {
  const byId = new Map(options.map((o) => [o.pokemonId, o]));

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Escolha quem vai lutar">
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
                'w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors duration-fast outline-none',
                'focus-visible:ring-2 focus-visible:ring-highlight/70',
                selected
                  ? 'border-highlight bg-highlight-soft'
                  : 'border-border bg-surface-2 hover:border-border-strong',
              )}
            >
              <img
                src={p.form.sprite}
                alt=""
                className="w-12 h-12 object-contain [image-rendering:pixelated] shrink-0"
                draggable={false}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-text truncate">{p.form.name}</p>
                  <span className="text-[11px] font-mono text-subtle shrink-0">Nv. {o.level}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {o.types.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-semibold uppercase tracking-wider px-1 rounded"
                      style={{ color: TYPE_COLOR[t], backgroundColor: `${TYPE_COLOR[t]}1F` }}
                    >
                      {TYPE_LABEL[t]}
                    </span>
                  ))}
                </div>
                <p className="mt-0.5 text-[10px] text-subtle">
                  Selvagem no Nv. {o.wildLevel}
                  {m && (
                    <span
                      className={cn(
                        'ml-1.5 font-semibold',
                        m.tone === 'good' && 'text-success',
                        m.tone === 'bad' && 'text-danger',
                        m.tone === 'none' && 'text-muted',
                      )}
                    >
                      · {m.text}
                    </span>
                  )}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
