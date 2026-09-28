import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PokeballIcon } from '../components/ui/PokeballIcon';
import { cn } from '../utils/cn';
import {
  STARTER_LINES,
  XP_THRESHOLDS,
  spriteUrl,
  type EvolutionLine,
} from '../data/pokedex';
import { catchPokemon } from '../services/trainer';
import { useTrainerStore } from '../store/useTrainerStore';
import { ApiError } from '../services/api';

const GEN_LABEL: Record<number, string> = {
  0: 'Especiais',
  1: 'Geração I',
  2: 'Geração II',
  3: 'Geração III',
  4: 'Geração IV',
  5: 'Geração V',
  6: 'Geração VI',
  7: 'Geração VII',
  8: 'Geração VIII',
  9: 'Geração IX',
};

const ERROR_MESSAGES: Record<string, string> = {
  POKEMON_LIMIT: 'Você já tem um Pokémon. Libere o atual antes de escolher outro.',
  INVALID_LINE: 'Esse Pokémon não está na lista.',
  DB_UNAVAILABLE: 'O servidor não respondeu. Tente de novo em instantes.',
};

/** Ordem de exibição: gerações na ordem, curingas (gen 0) por último. */
function byGeneration(): Array<[number, EvolutionLine[]]> {
  const groups = new Map<number, EvolutionLine[]>();
  for (const line of STARTER_LINES) {
    const list = groups.get(line.gen) ?? [];
    list.push(line);
    groups.set(line.gen, list);
  }
  return [...groups.entries()].sort((a, b) => (a[0] || 99) - (b[0] || 99));
}

interface StarterPageProps {
  /** Texto do topo. Muda quando é uma troca em vez da primeira escolha. */
  title?: string;
}

export default function StarterPage({ title }: StarterPageProps) {
  const groups = useMemo(byGeneration, []);
  const apply = useTrainerStore((s) => s.apply);

  const [selected, setSelected] = useState<EvolutionLine | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rollTimers = useRef<number[]>([]);

  /**
   * Herda o clima do sorteio que o antigo PokemonPicker tinha: percorre a lista
   * com passos desacelerando até parar numa linha.
   */
  const surprise = () => {
    for (const t of rollTimers.current) window.clearTimeout(t);
    rollTimers.current = [];
    const steps = [60, 60, 70, 90, 120, 160, 220, 300];
    let elapsed = 0;
    steps.forEach((step, i) => {
      elapsed += step;
      const t = window.setTimeout(() => {
        setSelected(STARTER_LINES[Math.floor(Math.random() * STARTER_LINES.length)]);
        if (i === steps.length - 1) rollTimers.current = [];
      }, elapsed);
      rollTimers.current.push(t);
    });
  };

  const confirm = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      apply(await catchPokemon(selected.id));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'DB_UNAVAILABLE';
      setError(ERROR_MESSAGES[code] ?? 'Não foi possível escolher agora.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-dot-grid flex flex-col animate-fade-in">
      <header className="pt-14 pb-8 px-6 text-center">
        <PokeballIcon size={26} className="text-brand mx-auto mb-5" />
        <h1 className="text-xl font-semibold tracking-tight text-text">
          {title ?? 'Escolha seu primeiro Pokémon'}
        </h1>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          Ele acompanha você em todas as salas e evolui conforme suas estimativas
          chegam perto da média da mesa.
        </p>
      </header>

      {/*
        Cada geração tem EXATAMENTE 3 iniciais, então a grade de 3 colunas é
        interna ao bloco da geração, e são os blocos que se distribuem na
        largura. Uma grade única de 6 colunas deixaria metade de cada linha
        vazia.
      */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pb-40">
        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(([gen, lines]) => (
            <section key={gen}>
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-subtle mb-2.5">
                {GEN_LABEL[gen] ?? `Geração ${gen}`}
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
                  {lines.map((line) => {
                    const first = line.stages[0];
                    const isSelected = selected?.id === line.id;
                    return (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => setSelected(line)}
                        className={cn(
                          'group relative flex flex-col items-center gap-1 rounded-xl border p-3',
                          'transition-all duration-200 lift-on-hover',
                          isSelected
                            ? 'border-brand bg-surface-3 shadow-[0_0_0_3px_rgba(239,68,68,0.14)]'
                            : 'border-border bg-surface-2 hover:border-border-strong',
                        )}
                        aria-pressed={isSelected}
                      >
                        <img
                          src={spriteUrl(first.id)}
                          alt=""
                          loading="lazy"
                          className={cn(
                            'w-14 h-14 object-contain transition-transform duration-200',
                            isSelected ? 'scale-110' : 'group-hover:scale-105',
                          )}
                        />
                        <span
                          className={cn(
                            'text-[11px] truncate max-w-full',
                            isSelected ? 'text-text font-medium' : 'text-muted',
                          )}
                        >
                          {first.name}
                        </span>
                      </button>
                    );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Barra fixa: a linha completa do escolhido + confirmação. */}
      {/*
        `bg-surface` sem modificador de opacidade DE PROPÓSITO. Os tokens de cor
        são `var(--...)` no tailwind.config, e o Tailwind 3 não consegue aplicar
        `/opacidade` a eles — `bg-surface/95` compila para transparente. Aqui a
        barra é fixa e o conteúdo rola por baixo, então precisa ser opaca.
      */}
      <div className="fixed bottom-0 inset-x-0 border-t border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3"
            >
              {selected.stages.map((form, i) => (
                <div key={form.id} className="flex items-center gap-3">
                  {i > 0 && (
                    <div className="text-[10px] font-mono text-subtle whitespace-nowrap">
                      {XP_THRESHOLDS[i]} XP →
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <img src={spriteUrl(form.id)} alt="" className="w-11 h-11 object-contain" />
                    <span className="text-[10px] text-muted">{form.name}</span>
                  </div>
                </div>
              ))}
              {selected.branches && (
                <div className="flex items-center gap-2 ml-1">
                  <div className="text-[10px] font-mono text-subtle whitespace-nowrap">
                    {XP_THRESHOLDS[1]} XP →
                  </div>
                  <div className="flex -space-x-2">
                    {selected.branches.map(([b]) => (
                      <img
                        key={b.id}
                        src={spriteUrl(b.id)}
                        alt=""
                        title={b.name}
                        className="w-8 h-8 object-contain rounded-full bg-surface-2 border border-border"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-subtle">você escolhe</span>
                </div>
              )}
            </motion.div>
          ) : (
            <p className="text-xs text-subtle flex items-center gap-2">
              <Sparkles size={13} />
              Selecione um Pokémon para ver a linha evolutiva completa.
            </p>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="secondary" onClick={surprise} disabled={saving}>
              <Dices size={14} />
              Surpreenda-me
            </Button>
            <Button
              variant="solid"
              size="lg"
              className="press-down min-w-[170px]"
              onClick={confirm}
              disabled={!selected || saving}
            >
              {saving
                ? 'Escolhendo...'
                : selected
                  ? `Começar com ${selected.stages[0].name}`
                  : 'Escolher'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="max-w-5xl mx-auto px-6 pb-4 -mt-1">
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
