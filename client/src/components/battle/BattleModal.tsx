import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, Flag, Layers, TrendingUp, Swords, X } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Confetti } from '../Confetti';
import { CountUpValue } from '../CountUpValue';
import { cn } from '../../utils/cn';
import { ApiError } from '../../services/api';
import {
  forfeitBattle,
  getBattle,
  playCard,
  startBattle,
  type Battle,
  type BattleEvent,
  type Side,
} from '../../services/battle';
import type { DailyCapture } from '../../services/capture';
import type { Pokemon } from '../../types';
import { useCaptureStore } from '../../store/useCaptureStore';
import { useTrainerStore } from '../../store/useTrainerStore';
import { BattleScene, type SceneFx } from './BattleScene';
import { DialogBox } from './DialogBox';
import type { SpriteFx } from './FighterPanel';
import { MoveCard } from './MoveCard';
import { PokemonPicker } from './PokemonPicker';
import { eventText } from './labels';
import { CHAR_MS } from './useTypewriter';

interface BattleModalProps {
  open: boolean;
  onClose: () => void;
  capture: DailyCapture;
}

const ERRORS: Record<string, string> = {
  BATTLE_USED: 'Você já batalhou hoje.',
  NOT_AVAILABLE: 'Este Pokémon não está mais disponível.',
  INVALID_POKEMON: 'Esse Pokémon não está na sua coleção.',
  NO_ACTIVE_BATTLE: 'A batalha já terminou.',
  NO_BATTLE: 'Nenhuma batalha em andamento.',
  INVALID_CARD: 'Essa carta não está mais na mão.',
  BATTLE_OVER: 'A batalha já terminou.',
  DAY_CHANGED: 'O dia virou. Já tem outro Pokémon.',
  DB_UNAVAILABLE: 'O servidor não respondeu. Tente de novo.',
};

const errorText = (err: unknown) =>
  (err instanceof ApiError && ERRORS[err.code]) || 'Algo deu errado. Tente de novo.';

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/**
 * Quanto cada evento fica na tela. O golpe em si respira mais que o resto, e
 * nenhuma frase é cortada antes de terminar de ser digitada.
 */
function stepMs(e: BattleEvent, reduced: boolean, text: string | null): number {
  if (reduced) return 150;
  const base = e.kind === 'move' ? 560 : e.kind === 'faint' ? 760 : 460;
  return Math.max(base, text ? text.length * CHAR_MS + 320 : 0);
}

/** Leque da mão: as das pontas inclinam, a do meio fica um pouco acima. */
const FAN = [
  { rotate: -4, lift: 6 },
  { rotate: 0, lift: 0 },
  { rotate: 4, lift: 6 },
];

/** Montinho de cartas do rodapé. */
function Pile({ count, label }: { count: number; label: string }) {
  return (
    <span className="flex items-center gap-2" title={`${label}: ${count}`}>
      <span aria-hidden className="relative w-4 h-5">
        {count > 1 && <span className="absolute inset-0 translate-x-[3px] -translate-y-[3px] rounded-[3px] border border-border-strong bg-surface-3" />}
        <span
          className={cn(
            'absolute inset-0 rounded-[3px] border',
            count > 0 ? 'border-border-strong bg-surface-4' : 'border-dashed border-border bg-transparent',
          )}
        />
      </span>
      <span className="font-pixel text-xs text-muted">
        {label} <span className="text-text tabular-nums">{count}</span>
      </span>
    </span>
  );
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
  const [message, setMessage] = useState('');
  const [playing, setPlaying] = useState(false);
  const [playedUid, setPlayedUid] = useState<string | null>(null);
  const [fx, setFx] = useState<Record<Side, SpriteFx | null>>({ player: null, wild: null });
  const [sceneFx, setSceneFx] = useState<SceneFx | null>(null);
  const fxCount = useRef(0);
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
    setMessage('');
    setFx({ player: null, wild: null });
    setSceneFx(null);
    if (capture.battle.status === 'active') {
      setStage('loading');
      getBattle()
        .then((b) => {
          if (!alive.current) return;
          setBattle(b);
          setStage('fight');
          setMessage(`O que ${b.player.name} vai fazer?`);
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
      setMessage(`Um ${b.wild.name} selvagem apareceu! Vai, ${b.player.name}!`);
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
      const spriteFx = (side: Side, kind: SpriteFx['kind']) =>
        setFx((f) => ({ ...f, [side]: { kind, n: ++fxCount.current } }));
      let view = battle;
      for (const e of res.events) {
        view = applyEvent(view, e);
        setBattle(view);
        const text = eventText(e, names);
        if (text) setMessage(text);
        if (e.kind === 'move') spriteFx(e.side, 'lunge');
        if ((e.kind === 'damage' || e.kind === 'selfHit' || e.kind === 'residual') && e.amount > 0) {
          spriteFx(e.side, 'hit');
        }
        if (e.kind === 'damage' && e.amount > 0 && (e.crit || e.effectiveness > 1)) {
          setSceneFx({ kind: e.crit ? 'shake' : 'flash', n: ++fxCount.current });
        }
        await sleep(stepMs(e, reduced, text));
        if (!alive.current) return;
      }

      // O estado do servidor é a verdade: a mão nova só aparece aqui.
      setBattle(res.battle);
      if (res.trainer) applyTrainer(res.trainer);
      if (res.capture) setCapture(res.capture);
      if (res.battle.status === 'active') {
        setMessage(`O que ${res.battle.player.name} vai fazer?`);
      } else {
        await sleep(reduced ? 200 : 600);
        if (!alive.current) return;
        setResult({
          outcome: res.battle.status === 'won' ? 'won' : 'lost',
          bonus: res.battle.bonus,
          xp: res.battle.xpGained,
          chance: res.capture?.chance ?? capture.chance,
          evolution: res.evolution ?? null,
        });
        setMessage(res.battle.status === 'won' ? 'Você venceu!' : 'Você perdeu.');
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
      setMessage('Você fugiu.');
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

  const selectedOption = capture.battle.fighters.find((o) => o.pokemonId === selectedId);

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
        <div className="flex items-center justify-between px-5 h-12 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Swords size={16} className="text-highlight" />
            <h2 className="font-pixel text-base font-semibold text-text leading-none">Batalha</h2>
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

        <div className="battle-scope flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          {stage === 'pick' && (
            <div className="space-y-4">
              {/* Quem está do outro lado: contexto para a escolha. */}
              <div className="flex items-center gap-3">
                <img
                  src={capture.species.sprite}
                  alt=""
                  className="w-16 h-16 object-contain [image-rendering:pixelated] shrink-0"
                  draggable={false}
                />
                <div className="font-pixel min-w-0">
                  <p className="text-xs text-muted leading-none">Adversário</p>
                  <p className="mt-1 text-xl font-semibold text-text leading-tight truncate">
                    {capture.species.name}
                    {selectedOption && (
                      <span className="ml-2 text-sm font-normal text-muted">
                        <span className="text-[10px]">Nv</span>
                        {selectedOption.wildLevel}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <ul className="grid grid-cols-3 gap-2 font-pixel text-[11px] sm:text-xs leading-tight text-muted">
                <li className="flex items-start gap-1.5">
                  <Layers size={13} className="shrink-0 mt-px text-text" />
                  <span>
                    Jogue <span className="text-text">1 carta</span> por turno
                  </span>
                </li>
                <li className="flex items-start gap-1.5" title="Quanto mais HP sobrar, maior o bônus">
                  <TrendingUp size={13} className="shrink-0 mt-px text-success" />
                  <span>
                    Vitória: <span className="text-text">+20 a +50%</span> na captura
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CalendarClock size={13} className="shrink-0 mt-px text-highlight" />
                  <span>
                    <span className="text-text">1 por dia</span>. Não gasta Pokébola
                  </span>
                </li>
              </ul>

              <div>
                <p className="font-pixel text-sm text-text mb-2">Quem vai lutar?</p>
                {collection && collection.pokemon.length > 0 ? (
                  <PokemonPicker
                    pokemon={collection.pokemon}
                    options={capture.battle.fighters}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ) : (
                  <p className="text-xs text-subtle">Você ainda não tem Pokémon.</p>
                )}
              </div>

              {error && <p className="text-sm text-danger text-center animate-fade-in">{error}</p>}

              <Button
                variant="solid"
                size="lg"
                className="w-full press-down font-pixel text-base"
                disabled={!selectedId}
                onClick={() => void handleStart()}
              >
                <Swords size={16} />
                Lutar
              </Button>
            </div>
          )}

          {stage === 'loading' && (
            // Faixas pretas fechando a tela: a transição clássica antes da luta.
            <div
              className="relative aspect-[16/11] sm:aspect-[16/10] rounded-lg overflow-hidden border-2 border-black/60 bg-surface"
              aria-label="Preparando a batalha"
              role="status"
            >
              {!reduced &&
                Array.from({ length: 8 }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'absolute inset-x-0 h-[12.5%] bg-black animate-stripe-in',
                      i % 2 ? 'origin-right' : 'origin-left',
                    )}
                    style={{ top: `${i * 12.5}%`, animationDelay: `${i * 45}ms` }}
                  />
                ))}
            </div>
          )}

          {(stage === 'fight' || stage === 'result') && battle && (
            <div className="space-y-3">
              <BattleScene
                battle={battle}
                fx={fx}
                sceneFx={sceneFx}
                reduced={reduced}
                dimmed={stage === 'result' && result?.outcome === 'lost'}
              />

              <DialogBox message={message} instant={reduced} waiting={stage === 'fight' && !playing} />

              {stage === 'fight' && (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2 px-1">
                    {battle.hand.map((card, i) => {
                      const fan = FAN[i] ?? FAN[1];
                      return (
                        <div
                          key={card.uid}
                          className="transition-transform duration-base ease-out-expo hover:![transform:none]"
                          style={{ transform: `rotate(${fan.rotate}deg) translateY(${fan.lift}px)` }}
                        >
                          {/* Entrada e jogada em camadas separadas: o `fill` da entrada prenderia o transform. */}
                          <div className={cn(!reduced && 'animate-fade-up')} style={{ animationDelay: `${i * 70}ms` }}>
                            <div
                              className={cn(
                                'transition-[opacity,transform] duration-slow ease-out-expo',
                                playedUid === card.uid && '-translate-y-24 scale-75 opacity-0',
                              )}
                            >
                              <MoveCard
                                move={card.move}
                                disabled={playing || battle.status !== 'active'}
                                onPlay={() => void handlePlay(card.uid)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-4">
                      <Pile count={battle.deckCount} label="Deck" />
                      <Pile count={battle.discardCount} label="Descarte" />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleForfeit()}
                      disabled={playing}
                      className={cn(
                        'flex items-center gap-1 font-pixel text-xs transition-colors disabled:opacity-40',
                        confirmForfeit ? 'text-danger font-semibold' : 'text-subtle hover:text-danger',
                      )}
                    >
                      <Flag size={12} />
                      {confirmForfeit ? 'Fugir mesmo?' : 'Fugir'}
                    </button>
                  </div>

                  {error && <p className="text-sm text-danger text-center animate-fade-in">{error}</p>}
                </>
              )}

              {stage === 'result' && result && (
                <div className="space-y-3 pt-1 animate-fade-up">
                  {result.outcome === 'won' && (
                    <div className="gba-hud px-4 py-3 font-pixel">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm">Bônus de captura</span>
                        <span className="text-xl font-semibold text-[#2F8A47] tabular-nums">
                          +<CountUpValue value={String(result.bonus)} active delayMs={400} durationMs={700} />%
                        </span>
                      </div>
                      {result.xp > 0 && (
                        <div className="mt-1 flex items-baseline justify-between gap-3">
                          <span className="text-sm">XP de {battle.player.name}</span>
                          <span className="text-xl font-semibold text-[#B7791F] tabular-nums">
                            +<CountUpValue value={String(result.xp)} active delayMs={700} durationMs={700} />
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="font-pixel text-sm text-muted text-center">
                    Chance por Pokébola: <span className="text-text">{result.chance}%</span>
                  </p>

                  {result.evolution && (
                    <div className="gba-hud mx-auto max-w-xs px-3 py-2.5 text-center font-pixel">
                      <p className="text-xs opacity-70">Evolução</p>
                      <div className="mt-1 flex items-center justify-center gap-3">
                        <img
                          src={result.evolution.from.sprite}
                          alt={result.evolution.from.name}
                          className="w-16 h-16 [image-rendering:pixelated]"
                        />
                        <ArrowRight size={16} className="opacity-60" />
                        <img
                          src={result.evolution.to.sprite}
                          alt={result.evolution.to.name}
                          className="w-16 h-16 [image-rendering:pixelated]"
                        />
                      </div>
                      <p className="text-sm font-semibold">
                        {result.evolution.from.name} evoluiu para {result.evolution.to.name}!
                      </p>
                    </div>
                  )}

                  <Button variant="solid" size="lg" className="w-full press-down font-pixel text-base" onClick={onClose}>
                    Voltar à captura
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>

      <Confetti active={open && result?.outcome === 'won'} className="z-[60]" />
    </>
  );
}
