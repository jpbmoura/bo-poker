import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Flag, Layers, Swords, X } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Confetti } from '../Confetti';
import { cn } from '../../utils/cn';
import { ApiError } from '../../services/api';
import {
  forfeitBattle,
  getBattle,
  playCard,
  startBattle,
  type Battle,
  type BattleEvent,
} from '../../services/battle';
import type { DailyCapture } from '../../services/capture';
import type { Pokemon } from '../../types';
import { useCaptureStore } from '../../store/useCaptureStore';
import { useTrainerStore } from '../../store/useTrainerStore';
import { FighterPanel } from './FighterPanel';
import { MoveCard } from './MoveCard';
import { PokemonPicker } from './PokemonPicker';
import { eventText } from './labels';

interface BattleModalProps {
  open: boolean;
  onClose: () => void;
  capture: DailyCapture;
}

const ERRORS: Record<string, string> = {
  BATTLE_USED: 'Você já batalhou hoje.',
  NOT_AVAILABLE: 'Este Pokémon não está mais disponível para captura.',
  INVALID_POKEMON: 'Esse Pokémon não está na sua coleção.',
  NO_ACTIVE_BATTLE: 'A batalha já terminou.',
  NO_BATTLE: 'Nenhuma batalha em andamento.',
  INVALID_CARD: 'Essa carta não está mais na sua mão.',
  BATTLE_OVER: 'A batalha já terminou.',
  DAY_CHANGED: 'O dia virou! Um novo Pokémon apareceu.',
  DB_UNAVAILABLE: 'O servidor não respondeu. Tente de novo em instantes.',
};

const errorText = (err: unknown) =>
  (err instanceof ApiError && ERRORS[err.code]) || 'Algo deu errado. Tente de novo.';

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Quanto cada evento fica na tela. O golpe em si respira mais que o resto. */
function stepMs(e: BattleEvent, reduced: boolean): number {
  if (reduced) return 150;
  if (e.kind === 'move') return 520;
  if (e.kind === 'faint') return 700;
  return 420;
}

/** Aplica um evento na cópia exibida: HP, status e estágios mudam no ritmo do log. */
function applyEvent(view: Battle, e: BattleEvent): Battle {
  if (!('side' in e)) return view;
  const f = { ...view[e.side], stages: { ...view[e.side].stages } };
  switch (e.kind) {
    case 'damage':
    case 'heal':
    case 'selfHit':
    case 'residual':
      f.hp = e.hp;
      break;
    case 'ailment':
      f.ailment = e.ailment;
      break;
    case 'cure':
      f.ailment = null;
      break;
    case 'confused':
      f.confused = true;
      break;
    case 'confusionEnd':
      f.confused = false;
      break;
    case 'stat': {
      const next = (f.stages[e.stat] ?? 0) + e.delta;
      if (next === 0) delete f.stages[e.stat];
      else f.stages[e.stat] = next;
      break;
    }
    case 'faint':
      f.hp = 0;
      break;
    default:
      return view;
  }
  return { ...view, [e.side]: f };
}

type Stage = 'pick' | 'loading' | 'fight' | 'result';

interface Result {
  outcome: 'won' | 'lost';
  bonus: number;
  xp: number;
  chance: number;
  evolution: { from: Pokemon; to: Pokemon } | null;
}

export function BattleModal({ open, onClose, capture }: BattleModalProps) {
  const collection = useTrainerStore((s) => s.collection);
  const applyTrainer = useTrainerStore((s) => s.apply);
  const setCapture = useCaptureStore((s) => s.set);
  const reloadCapture = useCaptureStore((s) => s.load);
  const reduced = useReducedMotion() ?? false;

  const [stage, setStage] = useState<Stage>('pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playedUid, setPlayedUid] = useState<string | null>(null);
  const [hits, setHits] = useState({ player: 0, wild: 0 });
  const [error, setError] = useState<string | null>(null);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Ao abrir: retoma a batalha em andamento, ou volta para a escolha.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    setConfirmForfeit(false);
    setLog([]);
    if (capture.battle.status === 'active') {
      setStage('loading');
      getBattle()
        .then((b) => {
          if (!alive.current) return;
          setBattle(b);
          setStage('fight');
          setLog(['A batalha continua!']);
        })
        .catch((err) => {
          if (!alive.current) return;
          setError(errorText(err));
          setStage('pick');
        });
      return;
    }
    setBattle(null);
    setStage('pick');
    // Sugestão inicial: quem tem vantagem de tipo, senão o de maior nível.
    const options = [...capture.battle.fighters].sort(
      (a, b) => b.attack - b.defense - (a.attack - a.defense) || b.level - a.level,
    );
    setSelectedId(options[0]?.pokemonId ?? null);
    // Só ao abrir: o capture muda durante a batalha e não pode reiniciar a tela.
  }, [open]);

  const handleStart = async () => {
    if (!selectedId) return;
    setStage('loading');
    setError(null);
    try {
      const b = await startBattle(capture.day, selectedId);
      if (!alive.current) return;
      setBattle(b);
      setLog([`Um ${b.wild.name} selvagem quer lutar! Vai, ${b.player.name}!`]);
      setStage('fight');
      void reloadCapture();
    } catch (err) {
      if (!alive.current) return;
      setError(errorText(err));
      setStage('pick');
      void reloadCapture();
    }
  };

  const handlePlay = async (uid: string) => {
    if (!battle || playing) return;
    setPlaying(true);
    setPlayedUid(uid);
    setConfirmForfeit(false);
    setError(null);
    try {
      const res = await playCard(capture.day, uid);
      if (!alive.current) return;

      const names = { player: battle.player.name, wild: battle.wild.name };
      let view = battle;
      for (const e of res.events) {
        view = applyEvent(view, e);
        setBattle(view);
        const text = eventText(e, names);
        if (text) setLog((l) => [...l.slice(-5), text]);
        if ((e.kind === 'damage' || e.kind === 'selfHit' || e.kind === 'residual') && e.amount > 0) {
          setHits((h) => ({ ...h, [e.side]: h[e.side] + 1 }));
        }
        await sleep(stepMs(e, reduced));
        if (!alive.current) return;
      }

      // O estado do servidor é a verdade: a mão nova só aparece aqui.
      setBattle(res.battle);
      if (res.trainer) applyTrainer(res.trainer);
      if (res.capture) setCapture(res.capture);
      if (res.battle.status !== 'active') {
        await sleep(reduced ? 200 : 600);
        if (!alive.current) return;
        setResult({
          outcome: res.battle.status === 'won' ? 'won' : 'lost',
          bonus: res.battle.bonus,
          xp: res.battle.xpGained,
          chance: res.capture?.chance ?? capture.chance,
          evolution: res.evolution ?? null,
        });
        setStage('result');
      }
    } catch (err) {
      if (!alive.current) return;
      setError(errorText(err));
      // Recarrega para a mão e o HP voltarem ao que o servidor tem.
      getBattle()
        .then((b) => alive.current && setBattle(b))
        .catch(() => {});
    } finally {
      if (alive.current) {
        setPlaying(false);
        setPlayedUid(null);
      }
    }
  };

  const handleForfeit = async () => {
    if (!confirmForfeit) {
      setConfirmForfeit(true);
      return;
    }
    setPlaying(true);
    try {
      const res = await forfeitBattle(capture.day);
      if (!alive.current) return;
      setBattle(res.battle);
      setCapture(res.capture);
      setResult({ outcome: 'lost', bonus: 0, xp: 0, chance: res.capture.chance, evolution: null });
      setStage('result');
    } catch (err) {
      if (alive.current) setError(errorText(err));
    } finally {
      if (alive.current) {
        setPlaying(false);
        setConfirmForfeit(false);
      }
    }
  };

  // Fechar com a batalha em andamento não perde nada: ela fica salva no servidor.
  const canClose = !playing && stage !== 'loading';

  return (
    <>
      <Dialog
        open={open}
        onClose={canClose ? onClose : undefined}
        dismissable={canClose}
        className="max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Swords size={16} className="text-highlight" />
            <div>
              <h2 className="text-sm font-semibold text-text">Batalha</h2>
              <p className="text-[11px] text-subtle">
                {stage === 'fight' && battle
                  ? `Turno ${battle.turn} de ${battle.maxTurns}`
                  : 'Vença para aumentar a chance de captura.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!canClose}
            className="text-subtle hover:text-text transition-colors disabled:opacity-40"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {stage === 'pick' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted leading-relaxed">
                Cada golpe do seu Pokémon vira uma carta. Você tem 3 na mão: jogue uma por turno e compre
                outra. Vencer soma de <strong className="text-text">+20</strong> a{' '}
                <strong className="text-text">+50 pontos</strong> na chance de captura (quanto mais HP sobrar,
                mais pontos) e dá XP para quem lutou. Perder não gasta Pokébola, mas só dá para batalhar uma
                vez por dia.
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-2">Quem vai lutar contra {capture.species.name}?</p>
                {collection && collection.pokemon.length > 0 ? (
                  <PokemonPicker
                    pokemon={collection.pokemon}
                    options={capture.battle.fighters}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ) : (
                  <p className="text-xs text-subtle">Você ainda não tem Pokémon para lutar.</p>
                )}
              </div>

              {error && <p className="text-sm text-danger text-center animate-fade-in">{error}</p>}

              <Button
                variant="solid"
                size="lg"
                className="w-full press-down"
                disabled={!selectedId}
                onClick={() => void handleStart()}
              >
                <Swords size={16} />
                Começar batalha
              </Button>
            </div>
          )}

          {stage === 'loading' && (
            <div className="h-64 flex items-center justify-center text-xs text-subtle">Preparando a arena…</div>
          )}

          {stage === 'fight' && battle && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-gradient-to-b from-surface-2 to-surface p-3 sm:p-4 space-y-3">
                <FighterPanel
                  fighter={battle.wild}
                  side="wild"
                  hitKey={hits.wild}
                  fainted={battle.wild.hp === 0}
                  reduced={reduced}
                />
                <FighterPanel
                  fighter={battle.player}
                  side="player"
                  hitKey={hits.player}
                  fainted={battle.player.hp === 0}
                  reduced={reduced}
                />
              </div>

              <div
                className="rounded-lg bg-surface-2 border border-border px-3 py-2 h-[4.5rem] overflow-hidden flex flex-col justify-end"
                aria-live="polite"
              >
                {log.slice(-3).map((line, i, arr) => (
                  <p
                    key={`${log.length}-${i}`}
                    className={cn(
                      'text-xs leading-5 truncate',
                      i === arr.length - 1 ? 'text-text' : 'text-subtle',
                    )}
                  >
                    {line}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {battle.hand.map((card) => (
                  <div
                    key={card.uid}
                    className={cn(
                      'transition-[opacity,transform] duration-base ease-out-expo',
                      playedUid === card.uid && 'opacity-0 -translate-y-6',
                    )}
                  >
                    <MoveCard
                      move={card.move}
                      disabled={playing || battle.status !== 'active'}
                      onPlay={() => void handlePlay(card.uid)}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-subtle">
                <span className="flex items-center gap-1.5 font-mono">
                  <Layers size={12} />
                  Deck {battle.deckCount} · Descarte {battle.discardCount}
                </span>
                <button
                  type="button"
                  onClick={() => void handleForfeit()}
                  disabled={playing}
                  className={cn(
                    'flex items-center gap-1 transition-colors disabled:opacity-40',
                    confirmForfeit ? 'text-danger font-semibold' : 'hover:text-danger',
                  )}
                >
                  <Flag size={12} />
                  {confirmForfeit ? 'Confirmar: desistir' : 'Desistir'}
                </button>
              </div>

              {error && <p className="text-sm text-danger text-center animate-fade-in">{error}</p>}
            </div>
          )}

          {stage === 'result' && result && (
            <div className="py-4 text-center space-y-4 animate-fade-up">
              {result.outcome === 'won' ? (
                <>
                  <p className="text-2xl font-semibold text-text tracking-tight">Vitória!</p>
                  <div className="flex justify-center gap-3">
                    <div className="rounded-xl border border-success/30 bg-success-soft px-4 py-3">
                      <p className="text-2xl font-semibold font-mono text-success">+{result.bonus}</p>
                      <p className="text-[11px] text-muted">pontos na captura</p>
                    </div>
                    {result.xp > 0 && (
                      <div className="rounded-xl border border-highlight/30 bg-highlight-soft px-4 py-3">
                        <p className="text-2xl font-semibold font-mono text-highlight">+{result.xp}</p>
                        <p className="text-[11px] text-muted">XP para {battle?.player.name}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    Agora cada Pokébola tem <strong className="text-text">{result.chance}%</strong> de chance.
                  </p>
                  {result.evolution && (
                    <div className="mx-auto max-w-xs rounded-xl border border-border bg-surface-2 p-3">
                      <p className="text-xs text-muted">A batalha rendeu uma evolução!</p>
                      <div className="mt-2 flex items-center justify-center gap-3">
                        <img
                          src={result.evolution.from.sprite}
                          alt={result.evolution.from.name}
                          className="w-16 h-16 [image-rendering:pixelated]"
                        />
                        <ArrowRight size={16} className="text-subtle" />
                        <img
                          src={result.evolution.to.sprite}
                          alt={result.evolution.to.name}
                          className="w-16 h-16 [image-rendering:pixelated]"
                        />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-text">
                        {result.evolution.from.name} evoluiu para {result.evolution.to.name}!
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold text-text tracking-tight">Derrota</p>
                  <p className="text-sm text-muted">
                    Suas Pokébolas continuam com {result.chance}% de chance. Tente a sorte mesmo assim!
                  </p>
                </>
              )}
              <Button variant="solid" size="lg" className="press-down" onClick={onClose}>
                Voltar à captura
              </Button>
            </div>
          )}
        </div>
      </Dialog>

      <Confetti active={open && result?.outcome === 'won'} className="z-[60]" />
    </>
  );
}
