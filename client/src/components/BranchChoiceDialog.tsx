import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { cn } from '../utils/cn';
import { EEVEE_LINE_ID, findLine, spriteUrl } from '../data/pokedex';
import { chooseBranch } from '../services/trainer';
import { useTrainerStore } from '../store/useTrainerStore';
import type { TrainerPokemon } from '../services/trainer';

interface BranchChoiceDialogProps {
  /** O Pokémon ativo, já sabido como pendente de escolha de ramo. */
  pokemon: TrainerPokemon;
}

/**
 * A escolha do ramo (a pedra do Eevee, Oddish -> Vileplume/Bellossom, Wurmple…).
 * Só o dono vê — a condição é lida do `pendingChoice` do PRÓPRIO jogador, nunca
 * da mesa.
 *
 * A escolha é definitiva: por isso o texto avisa antes, e a confirmação é
 * explícita em vez de um clique só.
 */
export function BranchChoiceDialog({ pokemon }: BranchChoiceDialogProps) {
  const line = findLine(pokemon.progress.lineId);
  const isEevee = line?.id === EEVEE_LINE_ID;
  const apply = useTrainerStore((s) => s.apply);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!line?.branches) return null;
  const pickedEntry = line.branches.find(([first]) => first.id === picked)?.[0] ?? null;
  // Classes literais: o Tailwind não enxerga nomes montados em runtime.
  const cols =
    line.branches.length >= 4 ? 'grid-cols-4' : line.branches.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  const confirm = async () => {
    if (!pickedEntry || busy) return;
    setBusy(true);
    setError(null);
    try {
      apply(await chooseBranch(pokemon.id, pickedEntry.id));
      // A animação chega pelo `pokemon:evolved` que o servidor difunde.
    } catch {
      setError('Não foi possível escolher agora. Tente de novo.');
      setBusy(false);
    }
  };

  return (
    <Dialog open className="max-w-md">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <motion.img
            src={pokemon.form.sprite}
            alt=""
            className="w-12 h-12 object-contain"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div>
            <h2 className="text-base font-semibold text-text">
              Seu {pokemon.form.name} quer evoluir!
            </h2>
            <p className="text-xs text-subtle">
              {isEevee ? 'Escolha a pedra.' : 'Escolha o caminho.'} Essa escolha é{' '}
              <strong>definitiva</strong>.
            </p>
          </div>
        </div>

        <div className={cn('grid gap-2 mt-5', cols)}>
          {line.branches.map((path) => {
            const branch = path[0];
            const last = path[path.length - 1];
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => setPicked(branch.id)}
                disabled={busy}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all duration-200',
                  picked === branch.id
                    ? 'border-highlight bg-highlight-soft'
                    : 'border-border bg-surface-2 hover:border-border-strong',
                )}
                aria-pressed={picked === branch.id}
              >
                <img
                  src={spriteUrl(branch.id)}
                  alt=""
                  className={cn(
                    'w-11 h-11 object-contain transition-transform',
                    picked === branch.id && 'scale-110',
                  )}
                />
                <span className="text-[11px] text-muted truncate max-w-full">{branch.name}</span>
                {/* Ramo com mais de uma forma: mostra onde ele termina. */}
                {path.length > 1 && (
                  <span className="text-[10px] text-subtle truncate max-w-full">
                    → {last.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-4 text-xs text-danger">{error}</p>}

        <Button
          variant="solid"
          size="lg"
          className="w-full mt-5 press-down"
          onClick={confirm}
          disabled={!pickedEntry || busy}
        >
          {busy
            ? 'Evoluindo...'
            : pickedEntry
              ? `Evoluir para ${pickedEntry.name}`
              : isEevee
                ? 'Escolha uma pedra'
                : 'Escolha a evolução'}
        </Button>
      </div>
    </Dialog>
  );
}
