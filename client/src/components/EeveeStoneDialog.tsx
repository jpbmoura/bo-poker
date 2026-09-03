import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { cn } from '../utils/cn';
import { EEVEE_LINE_ID, findLine, spriteUrl } from '../data/pokedex';
import { chooseBranch } from '../services/trainer';
import { useTrainerStore } from '../store/useTrainerStore';
import type { TrainerPokemon } from '../services/trainer';

interface EeveeStoneDialogProps {
  /** O Pokémon ativo, já sabido como Eevee pendente. */
  pokemon: TrainerPokemon;
}

/**
 * A escolha da pedra. Só o dono vê — a condição é lida do `pendingChoice` do
 * PRÓPRIO jogador, nunca da mesa.
 *
 * É a única linha ramificada do catálogo, e a escolha é definitiva: por isso o
 * texto avisa antes, e a confirmação é explícita em vez de um clique só.
 */
export function EeveeStoneDialog({ pokemon }: EeveeStoneDialogProps) {
  const line = findLine(EEVEE_LINE_ID);
  const apply = useTrainerStore((s) => s.apply);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!line?.branches) return null;
  const pickedEntry = line.branches.find((b) => b.id === picked) ?? null;

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
            src={spriteUrl(133)}
            alt=""
            className="w-12 h-12 object-contain"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div>
            <h2 className="text-base font-semibold text-text">Seu Eevee quer evoluir!</h2>
            <p className="text-xs text-subtle">
              Escolha a pedra. Essa escolha é <strong>definitiva</strong>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-5">
          {line.branches.map((branch) => (
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
              <span className="text-[10px] text-muted truncate max-w-full">{branch.name}</span>
            </button>
          ))}
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
              : 'Escolha uma pedra'}
        </Button>
      </div>
    </Dialog>
  );
}
