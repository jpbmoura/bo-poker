import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Confetti } from '../Confetti';
import { CaptureBall } from './CaptureBall';
import { CaptureScene, REDUCED_MS, SCENE_MS, type ScenePhase } from './CaptureScene';
import { TIER_STYLE } from './tierStyle';
import { cn } from '../../utils/cn';
import { TIER_LABEL, findLine, maxStage } from '../../data/pokedex';
import { ApiError } from '../../services/api';
import { throwPokeball, type CaptureAttempt, type DailyCapture } from '../../services/capture';
import { useCaptureStore } from '../../store/useCaptureStore';
import { useTrainerStore } from '../../store/useTrainerStore';

interface CaptureDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Leva para "Meus Pokémon" depois de uma captura. */
  onOpenCollection: () => void;
}

const ERRORS: Record<string, string> = {
  ALREADY_OWNED: 'Você já tem esse Pokémon.',
  NO_ATTEMPTS: 'Suas tentativas de hoje acabaram.',
  DAY_CHANGED: 'O dia virou! Um novo Pokémon apareceu.',
  DB_UNAVAILABLE: 'O servidor não respondeu. Tente de novo em instantes.',
};

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** "hh:mm:ss" até `iso`. Quando zera, pede o Pokémon novo. */
function useCountdown(iso: string | undefined, onZero: () => void): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = iso ? Math.max(0, new Date(iso).getTime() - now) : 0;
  const zero = iso !== undefined && left === 0;
  useEffect(() => {
    if (zero) onZero();
  }, [zero, onZero]);
  const s = Math.floor(left / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function stageCaption(capture: DailyCapture): string {
  const line = findLine(capture.lineId);
  if (!line) return '';
  const max = maxStage(line);
  if (max === 0) return 'Não evolui';
  if (capture.stage >= max) return 'Forma final';
  return `Estágio ${capture.stage + 1} de ${max + 1}`;
}

export function CaptureDrawer({ open, onClose, onOpenCollection }: CaptureDrawerProps) {
  const capture = useCaptureStore((s) => s.capture);
  const setCapture = useCaptureStore((s) => s.set);
  const reload = useCaptureStore((s) => s.load);
  const applyTrainer = useTrainerStore((s) => s.apply);

  // Reativo: mudar a preferência do sistema com o app aberto vale na hora.
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<ScenePhase>('idle');
  const [wobbles, setWobbles] = useState(0);
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const countdown = useCountdown(capture?.resetsAt, useCallback(() => void reload(), [reload]));

  const busy = phase !== 'idle';
  const canThrow = capture?.status === 'available' && !busy;

  const handleThrow = async () => {
    if (!capture || !canThrow) return;
    const ms = reduced ? REDUCED_MS : SCENE_MS;
    setMessage(null);
    setConfetti(false);

    // A request sai junto com o lançamento: a animação cobre a latência.
    const request: Promise<CaptureAttempt | ApiError> = throwPokeball(capture.day).catch(
      (err: unknown) => (err instanceof ApiError ? err : new ApiError(0, 'NETWORK')),
    );

    setPhase('throw');
    await sleep(ms.throw);
    if (!alive.current) return;
    setPhase('absorb');
    await sleep(ms.absorb);
    if (!alive.current) return;
    setPhase('wait');

    const result = await request;
    if (!alive.current) return;

    if (result instanceof ApiError) {
      setPhase('escape');
      await sleep(ms.escape);
      if (!alive.current) return;
      setPhase('idle');
      setMessage({ text: ERRORS[result.code] ?? 'Algo deu errado. Tente de novo.', tone: 'bad' });
      void reload();
      return;
    }

    // Sucesso sempre balança 3 vezes; na fuga, de 0 a 2 — o suspense é real.
    const n = result.success ? 3 : Math.floor(Math.random() * 3);
    if (n > 0) {
      setWobbles(n);
      setPhase('shake');
      await sleep(n * ms.wobble);
      if (!alive.current) return;
    }
    await sleep(ms.settle);
    if (!alive.current) return;

    if (result.success) {
      setPhase('caught');
      setConfetti(true);
      applyTrainer(result.trainer);
      await sleep(ms.caught);
      if (!alive.current) return;
      setMessage({ text: `${result.capture.species.name} foi capturado!`, tone: 'good' });
    } else {
      setPhase('escape');
      await sleep(ms.escape);
      if (!alive.current) return;
      const left = result.capture.maxAttempts - result.capture.attempts;
      setMessage({
        text:
          left > 0
            ? `Ah, não! Ele escapou da Pokébola.`
            : `${result.capture.species.name} fugiu! Volte amanhã.`,
        tone: 'bad',
      });
    }
    // O contador de tentativas e o status só mudam depois da cena.
    setCapture(result.capture);
    setPhase('idle');
  };

  // Fechar no meio não perde nada (o servidor já decidiu), mas limpa a cena.
  useEffect(() => {
    if (!open) {
      setMessage(null);
      setConfetti(false);
    }
  }, [open]);

  const style = capture ? TIER_STYLE[capture.tier] : null;
  const left = capture ? capture.maxAttempts - capture.attempts : 0;

  return (
    <>
      <Drawer open={open} onClose={busy ? () => {} : onClose} label="Captura do dia">
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text">Pokémon selvagem</h2>
            <p className="text-[11px] text-subtle">Um novo aparece todo dia.</p>
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

        {!capture || !style ? (
          <div className="flex-1 flex items-center justify-center text-xs text-subtle">
            Procurando Pokémon...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <CaptureScene
              sprite={capture.species.sprite}
              name={capture.species.name}
              phase={phase}
              wobbles={wobbles}
              glow={style.glow}
              reduced={reduced}
              captured={capture.status === 'caught' && phase === 'idle'}
            />

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-text tracking-tight">
                  {capture.species.name}
                </h3>
                <p className="text-[11px] text-subtle font-mono">
                  #{String(capture.species.id).padStart(3, '0')} · {stageCaption(capture)}
                </p>
              </div>
              <span
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border',
                  style.text,
                  style.bg,
                  style.border,
                )}
              >
                {TIER_LABEL[capture.tier]}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted">Chance de captura</span>
                <span className={cn('text-2xl font-semibold font-mono', style.text)}>
                  {capture.chance}%
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-surface-4 overflow-hidden">
                <div
                  className={cn('h-full rounded-full bg-current transition-[width] duration-500', style.text)}
                  style={{ width: `${capture.chance}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-subtle">
                Por tentativa. Quanto mais raro ou evoluído, mais difícil.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5" aria-label={`${left} tentativas restantes`}>
                {Array.from({ length: capture.maxAttempts }, (_, i) => (
                  <CaptureBall key={i} size={22} spent={i >= left} />
                ))}
              </div>
              <span className="text-xs text-muted">
                {left} de {capture.maxAttempts} tentativas
              </span>
            </div>

            {message && (
              <p
                className={cn(
                  'text-sm text-center animate-fade-in',
                  message.tone === 'good' ? 'text-success' : 'text-danger',
                )}
              >
                {message.text}
              </p>
            )}

            {capture.status === 'available' && (
              <Button
                variant="solid"
                size="lg"
                className="w-full press-down"
                onClick={() => void handleThrow()}
                disabled={!canThrow}
              >
                <CaptureBall size={18} />
                {busy ? 'Lançando…' : 'Lançar Pokébola'}
              </Button>
            )}

            {capture.status === 'caught' && phase === 'idle' && (
              <div className="rounded-xl border border-success/30 bg-success-soft p-4 text-center animate-fade-in">
                <p className="text-sm text-success font-medium">Capturado hoje!</p>
                <p className="text-xs text-muted mt-1">
                  Ele já está em Meus Pokémon e pode ir para a mesa.
                </p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={onOpenCollection}>
                  Ver meus Pokémon
                </Button>
              </div>
            )}

            {capture.status === 'fled' && phase === 'idle' && (
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-center animate-fade-in">
                <p className="text-sm text-text font-medium">Ele fugiu.</p>
                <p className="text-xs text-muted mt-1">Mais sorte amanhã!</p>
              </div>
            )}

            {capture.status === 'owned' && (
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-center">
                <p className="text-sm text-text font-medium">Você já tem essa linha.</p>
                <p className="text-xs text-muted mt-1">
                  Não dá para capturar um repetido. Volte amanhã para outro.
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
