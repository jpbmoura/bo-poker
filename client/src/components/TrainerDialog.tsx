import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { TrainerBadge } from './TrainerBadge';
import { cn } from '../utils/cn';
import { useTrainer } from '../hooks/useTrainer';
import { releasePokemon, setActivePokemon } from '../services/trainer';
import { useTrainerStore } from '../store/useTrainerStore';
import { spriteUrl, findLine } from '../data/pokedex';

interface TrainerDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Seus Pokémon". Renderiza a COLEÇÃO como lista — hoje com exatamente um item,
 * mas já num `map`. A marca de ativo e o botão de adicionar ficam escondidos
 * por `maxPokemon === 1`, não ausentes do código.
 */
export function TrainerDialog({ open, onClose }: TrainerDialogProps) {
  const { pokemon, maxPokemon, canAdd } = useTrainer();
  const apply = useTrainerStore((s) => s.apply);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const multi = maxPokemon > 1;

  const release = async (id: string) => {
    setBusy(true);
    try {
      apply(await releasePokemon(id));
      setConfirming(null);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const activate = async (id: string) => {
    setBusy(true);
    try {
      apply(await setActivePokemon(id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} dismissable className="max-w-md">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text">
              {multi ? 'Seus Pokémon' : 'Seu Pokémon'}
            </h2>
            <p className="text-xs text-subtle mt-0.5">
              Ganha XP quando sua estimativa chega perto da média da mesa.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-subtle hover:text-text transition-colors"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {pokemon.map((p) => {
            const line = findLine(p.progress.lineId);
            return (
              <div
                key={p.id}
                className={cn(
                  'rounded-xl border p-4',
                  p.isActive && multi
                    ? 'border-border-strong bg-surface-3'
                    : 'border-border bg-surface-2',
                )}
              >
                <TrainerBadge pokemon={p} />

                {/* A linha evolutiva inteira, com o estágio atual aceso. */}
                {line && (
                  <div className="mt-4 flex items-center gap-2">
                    {line.stages.map((form, i) => (
                      <img
                        key={form.id}
                        src={spriteUrl(form.id)}
                        alt={form.name}
                        title={form.name}
                        className={cn(
                          'w-8 h-8 object-contain transition-all',
                          i <= p.progress.stage
                            ? 'opacity-100'
                            : 'opacity-25 grayscale',
                        )}
                      />
                    ))}
                    {line.branches && (
                      <img
                        src={spriteUrl(p.form.id)}
                        alt=""
                        className={cn(
                          'w-8 h-8 object-contain',
                          p.progress.stage >= 1 ? 'opacity-100' : 'opacity-25 grayscale',
                        )}
                      />
                    )}
                  </div>
                )}

                {confirming === p.id ? (
                  <div className="mt-4 p-3 rounded-lg bg-danger-soft border border-danger/30">
                    <p className="text-xs text-danger flex items-start gap-2">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>
                        Você perde os <strong>{p.progress.xp} XP</strong> e escolhe
                        outro inicial do zero. Não dá para desfazer.
                      </span>
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void release(p.id)}
                        disabled={busy}
                      >
                        {busy ? 'Liberando...' : 'Sim, recomeçar'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirming(null)}
                        disabled={busy}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    {multi && !p.isActive && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void activate(p.id)}
                        disabled={busy}
                      >
                        Usar este
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-subtle hover:text-danger"
                      onClick={() => setConfirming(p.id)}
                      disabled={busy}
                    >
                      {multi ? 'Liberar' : 'Recomeçar do zero'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hoje nunca aparece (maxPokemon = 1). O caminho já existe. */}
        {canAdd && pokemon.length > 0 && (
          <p className="mt-4 text-xs text-subtle">
            Você pode ter até {maxPokemon} Pokémon.
          </p>
        )}
      </div>
    </Dialog>
  );
}
