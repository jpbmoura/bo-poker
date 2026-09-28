import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { TrainerBadge } from './TrainerBadge';
import { cn } from '../utils/cn';
import { useTrainer } from '../hooks/useTrainer';
import { releasePokemon, setActivePokemon, type TrainerPokemon } from '../services/trainer';
import { useTrainerStore } from '../store/useTrainerStore';
import { findLine, spriteUrl, type DexEntry } from '../data/pokedex';

interface TrainerDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * As formas da linha na ordem de evolução, com o ramo escolhido quando dá para
 * saber qual é (a forma atual está dentro dele). Sem ramo definido ainda, mostra
 * o 1º de cada ramo, que é o que a pessoa vai escolher.
 */
function evolutionPath(p: TrainerPokemon): DexEntry[][] {
  const line = findLine(p.progress.lineId);
  if (!line) return [];
  const steps: DexEntry[][] = line.stages.map((form) => [form]);
  if (!line.branches) return steps;
  const chosen = line.branches.find((path) => path.some((f) => f.id === p.form.id));
  if (chosen) return [...steps, ...chosen.map((form) => [form])];
  return [...steps, line.branches.map(([first]) => first)];
}

/**
 * "Meus Pokémon": a coleção inteira e a troca de quem vai para a mesa. Novos
 * membros chegam pela captura diária da home.
 */
export function TrainerDialog({ open, onClose }: TrainerDialogProps) {
  const { pokemon, active } = useTrainer();
  const apply = useTrainerStore((s) => s.apply);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Abre sempre focado no ativo.
  useEffect(() => {
    if (open) {
      setSelectedId(active?.id ?? null);
      setConfirming(false);
      setError(null);
    }
  }, [open, active?.id]);

  const selected = pokemon.find((p) => p.id === selectedId) ?? active ?? null;
  const isLast = pokemon.length === 1;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError('Não foi possível concluir agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const release = (id: string) =>
    run(async () => {
      apply(await releasePokemon(id));
      setConfirming(false);
      setSelectedId(null);
      if (isLast) onClose();
    });

  const activate = (id: string) =>
    run(async () => {
      apply(await setActivePokemon(id));
    });

  return (
    <Dialog open={open} onClose={onClose} dismissable className="max-w-xl">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text">
              Meus Pokémon
              <span className="ml-2 text-xs font-mono text-subtle">{pokemon.length}</span>
            </h2>
            <p className="text-xs text-subtle mt-0.5">
              O escolhido vai para a mesa e ganha XP quando sua estimativa chega perto
              da média.
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

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[220px] overflow-y-auto pr-1">
          {pokemon.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedId(p.id);
                setConfirming(false);
              }}
              title={p.form.name}
              className={cn(
                'relative flex flex-col items-center rounded-lg border p-1.5 transition-colors',
                selected?.id === p.id
                  ? 'border-border-strong bg-surface-3'
                  : 'border-border bg-surface-2 hover:border-border-strong',
              )}
              aria-pressed={selected?.id === p.id}
            >
              <img src={p.form.sprite} alt="" className="w-12 h-12 object-contain" />
              <span className="text-[11px] text-muted truncate max-w-full">{p.form.name}</span>
              {p.isActive && (
                <span
                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-highlight text-bg flex items-center justify-center"
                  title="Na mesa"
                >
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
            <TrainerBadge pokemon={selected} />

            {/* A linha evolutiva, com o estágio atual aceso. */}
            <div className="mt-4 flex items-center gap-2">
              {evolutionPath(selected).map((options, stage) => (
                <div key={stage} className="flex -space-x-2">
                  {options.map((form) => (
                    <img
                      key={form.id}
                      src={spriteUrl(form.id)}
                      alt={form.name}
                      title={form.name}
                      className={cn(
                        'w-8 h-8 object-contain transition-all',
                        stage <= selected.progress.stage ? 'opacity-100' : 'opacity-25 grayscale',
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>

            {confirming ? (
              <div className="mt-4 p-3 rounded-lg bg-danger-soft border border-danger/30">
                <p className="text-xs text-danger flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    {selected.form.name} volta para a natureza e você perde os{' '}
                    <strong>{selected.progress.xp} XP</strong>
                    {isLast ? ' — e escolhe outro inicial do zero' : ''}. Não dá para
                    desfazer.
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void release(selected.id)}
                    disabled={busy}
                  >
                    {busy ? 'Soltando...' : 'Sim, soltar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                {selected.isActive ? (
                  <span className="text-xs text-highlight flex items-center gap-1">
                    <Check size={12} /> Na mesa
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void activate(selected.id)}
                    disabled={busy}
                  >
                    Usar na mesa
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-subtle hover:text-danger"
                  onClick={() => setConfirming(true)}
                  disabled={busy}
                >
                  Soltar
                </Button>
              </div>
            )}

            {error && <p className="mt-3 text-xs text-danger">{error}</p>}
          </div>
        )}
      </div>
    </Dialog>
  );
}
