import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Clock, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Confetti } from '../Confetti';
import { cn } from '../../utils/cn';
import { normalizeName, wildSpecies } from '../../data/pokedex';
import { ApiError } from '../../services/api';
import { submitGuess, type GuessResult } from '../../services/guess';
import { useCountdown } from '../../hooks/useCountdown';
import { useGuessStore } from '../../store/useGuessStore';
import { useTrainerStore } from '../../store/useTrainerStore';
import { Silhouette } from './Silhouette';

interface GuessDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ERRORS: Record<string, string> = {
  ALREADY_GUESSED: 'Você já deu seu palpite hoje.',
  DAY_CHANGED: 'O dia virou! Um novo Pokémon apareceu.',
  INVALID_GUESS: 'Escolha um Pokémon da lista.',
  DB_UNAVAILABLE: 'O servidor não respondeu. Tente de novo em instantes.',
};

const MAX_SUGGESTIONS = 6;

/** Nomes da natureza (o mesmo pool do sorteio), sem repetição, pelo nome comparável. */
let namesCache: { name: string; key: string }[] | null = null;
function allNames(): { name: string; key: string }[] {
  if (namesCache) return namesCache;
  const seen = new Map<string, string>();
  for (const s of wildSpecies()) seen.set(normalizeName(s.entry.name), s.entry.name);
  namesCache = [...seen].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
  return namesCache;
}

export function GuessDrawer({ open, onClose }: GuessDrawerProps) {
  const guess = useGuessStore((s) => s.guess);
  const setGuess = useGuessStore((s) => s.set);
  const reload = useGuessStore((s) => s.load);
  const applyTrainer = useTrainerStore((s) => s.apply);
  const reduced = useReducedMotion() ?? false;

  const [text, setText] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(false);
  /** Evoluções do acerto feito nesta sessão do drawer. */
  const [evolutions, setEvolutions] = useState<GuessResult['evolutions']>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const countdown = useCountdown(guess?.resetsAt, useCallback(() => void reload(), [reload]));

  const key = normalizeName(text);
  const suggestions = useMemo(() => {
    if (!key) return [];
    return allNames()
      .filter((n) => n.key.startsWith(key))
      .slice(0, MAX_SUGGESTIONS);
  }, [key]);
  /** O palpite só vale se for um nome da lista: a chance é única, digitação errada não pode gastá-la. */
  const match = useMemo(() => allNames().find((n) => n.key === key) ?? null, [key]);

  useEffect(() => {
    if (open) {
      if (guess?.status === 'open') window.setTimeout(() => inputRef.current?.focus(), 250);
      return;
    }
    setText('');
    setError(null);
    setConfetti(false);
    setEvolutions([]);
    setListOpen(false);
  }, [open, guess?.status]);

  const pick = (name: string) => {
    setText(name);
    setListOpen(false);
    setHighlighted(0);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!guess || guess.status !== 'open' || !match || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitGuess(guess.day, match.name);
      applyTrainer(result.trainer);
      setEvolutions(result.evolutions);
      setGuess(result.guess);
      if (result.guess.status === 'correct') setConfetti(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'NETWORK';
      setError(ERRORS[code] ?? 'Algo deu errado. Tente de novo.');
      void reload();
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      // Enter com a lista aberta escolhe a sugestão; o segundo Enter chuta.
      const s = suggestions[highlighted];
      if (s && s.key !== key) {
        e.preventDefault();
        pick(s.name);
      }
    } else if (e.key === 'Escape') {
      // Não deixa o Esc chegar ao Drawer: fecha só a lista.
      e.stopPropagation();
      setListOpen(false);
    }
  };

  const revealed = guess?.answer ?? null;

  return (
    <>
      <Drawer open={open} onClose={busy ? () => {} : onClose} label="Quem é esse Pokémon?">
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text">Quem é esse Pokémon?</h2>
            <p className="text-[11px] text-subtle">Um novo mistério todo dia.</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-subtle hover:text-text transition-colors disabled:opacity-40"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {!guess ? (
          <div className="flex-1 flex items-center justify-center text-xs text-subtle">
            Procurando Pokémon...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="relative h-56 w-full overflow-hidden rounded-xl border border-border bg-surface-2">
              {/* Raios ao fundo, à moda do desenho. */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-60"
                style={{
                  background:
                    'repeating-conic-gradient(from 0deg at 50% 50%, rgb(var(--highlight) / 0.10) 0deg 10deg, transparent 10deg 20deg), radial-gradient(circle at 50% 50%, rgb(var(--highlight) / 0.22), transparent 65%)',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  {revealed ? (
                    <motion.img
                      key="revealed"
                      src={revealed.sprite}
                      alt={revealed.name}
                      className="w-40 h-40 object-contain [image-rendering:pixelated]"
                      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: 'brightness(0)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
                      transition={{ duration: reduced ? 0.2 : 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  ) : (
                    <motion.div
                      key="silhouette"
                      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.15 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Silhouette day={guess.day} className="w-40 h-40" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {revealed ? (
              <div className="text-center space-y-1 animate-fade-in">
                <p className="text-xs text-muted">É o...</p>
                <h3 className="text-2xl font-semibold text-text tracking-tight">{revealed.name}!</h3>
                <p className="text-[11px] text-subtle font-mono">#{String(revealed.id).padStart(3, '0')}</p>
              </div>
            ) : (
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setListOpen(true);
                      setHighlighted(0);
                      setError(null);
                    }}
                    onFocus={() => setListOpen(true)}
                    onBlur={() => window.setTimeout(() => setListOpen(false), 120)}
                    onKeyDown={onKeyDown}
                    placeholder="Digite o nome do Pokémon"
                    aria-label="Nome do Pokémon"
                    role="combobox"
                    aria-expanded={listOpen && suggestions.length > 0}
                    aria-controls="guess-suggestions"
                    aria-autocomplete="list"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={40}
                    disabled={busy}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-highlight/60 focus:ring-2 focus:ring-highlight/15 focus:bg-surface-3 transition-colors"
                  />
                  {listOpen && suggestions.length > 0 && !(suggestions.length === 1 && suggestions[0].key === key) && (
                    <ul
                      id="guess-suggestions"
                      role="listbox"
                      className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg border border-border bg-surface-2 shadow-lg overflow-hidden animate-fade-in"
                    >
                      {suggestions.map((s, i) => (
                        <li
                          key={s.key}
                          role="option"
                          aria-selected={i === highlighted}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pick(s.name);
                          }}
                          onMouseEnter={() => setHighlighted(i)}
                          className={cn(
                            'px-3 py-2 text-sm cursor-pointer transition-colors',
                            i === highlighted ? 'bg-surface-4 text-text' : 'text-muted',
                          )}
                        >
                          {s.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="solid"
                  size="lg"
                  className="w-full press-down"
                  disabled={!match || busy}
                >
                  {busy ? 'Revelando…' : match ? `É o ${match.name}!` : 'Chutar!'}
                </Button>

                <p className="text-[11px] text-subtle text-center">
                  Você só tem <span className="text-text font-semibold">uma chance</span>. Acertando,{' '}
                  <span className="text-highlight font-semibold">todos os seus Pokémon</span> ganham{' '}
                  <span className="text-highlight font-semibold">+{guess.reward} XP</span>.
                </p>
              </form>
            )}

            {error && <p className="text-sm text-center text-danger animate-fade-in">{error}</p>}

            {guess.status === 'correct' && (
              <div className="rounded-xl border border-success/30 bg-success-soft p-4 text-center animate-fade-in">
                <p className="text-sm text-success font-medium">Você acertou!</p>
                <p className="text-xs text-muted mt-1">
                  +{guess.xpGained} XP para todos os seus Pokémon.
                </p>
                {evolutions.map((evo) => (
                  <div key={`${evo.from.id}-${evo.to.id}`} className="mt-3">
                    <div className="flex items-center justify-center gap-3">
                      <img src={evo.from.sprite} alt={evo.from.name} className="w-14 h-14 [image-rendering:pixelated]" />
                      <ArrowRight size={16} className="text-subtle" />
                      <img src={evo.to.sprite} alt={evo.to.name} className="w-14 h-14 [image-rendering:pixelated]" />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-text">
                      {evo.from.name} evoluiu para {evo.to.name}!
                    </p>
                  </div>
                ))}
              </div>
            )}

            {guess.status === 'wrong' && (
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-center animate-fade-in">
                <p className="text-sm text-text font-medium">Não foi dessa vez.</p>
                <p className="text-xs text-muted mt-1">
                  Você chutou {guess.guess}. Tente de novo amanhã!
                </p>
              </div>
            )}
          </div>
        )}

        <div className="px-5 h-11 border-t border-border flex items-center justify-center gap-1.5 text-[11px] text-subtle font-mono shrink-0">
          <Clock size={12} />
          Novo Pokémon em {countdown}
        </div>
      </Drawer>

      <Confetti active={confetti} className="z-[60]" />
    </>
  );
}
