import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRoomStore } from '../store/useRoomStore';
import type { EvolutionEvent } from '../types';

/**
 * Marcos da animação, em ms a partir do início de CADA evolução. Curta de
 * propósito: ela entra no meio de um refinamento e não pode virar pedágio.
 */
const STROBE_END = 1100;
const FLASH_END = 1400;
const FADE_START = 1900;
const TOTAL = 2100;
/** Sem movimento: um card estático, só para a informação não se perder. */
const REDUCED_TOTAL = 900;
/** Um sprite lento não pode segurar a fila nem deixar o overlay em branco. */
const PRELOAD_TIMEOUT = 600;

type Phase = 'strobe' | 'flash' | 'settled' | 'out';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** Resolve quando a imagem carrega, falha, ou o timeout estoura — nunca pendura. */
function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(resolve, PRELOAD_TIMEOUT);
    const finish = () => {
      window.clearTimeout(timer);
      resolve();
    };
    img.onload = finish;
    img.onerror = finish;
    img.src = src;
  });
}

/**
 * Uma evolução. O sprite de destino já chega pré-carregado (o overlay espera
 * antes de montar a cena), então aqui nunca há estado "carregando" — o que
 * também é o que mantém a saída simples: a cena existe do primeiro frame ao
 * último e some por conta própria, sem `AnimatePresence`.
 */
function EvolutionScene({ event, onDone }: { event: EvolutionEvent; onDone: () => void }) {
  const reduced = useMemo(prefersReducedMotion, []);
  const [phase, setPhase] = useState<Phase>(reduced ? 'settled' : 'strobe');

  useEffect(() => {
    const timers: number[] = [];
    if (reduced) {
      timers.push(window.setTimeout(() => setPhase('out'), REDUCED_TOTAL - 200));
      timers.push(window.setTimeout(onDone, REDUCED_TOTAL));
    } else {
      timers.push(window.setTimeout(() => setPhase('flash'), STROBE_END));
      timers.push(window.setTimeout(() => setPhase('settled'), FLASH_END));
      timers.push(window.setTimeout(() => setPhase('out'), FADE_START));
      timers.push(window.setTimeout(onDone, TOTAL));
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [event, onDone, reduced]);

  const showNew = phase !== 'strobe';

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'out' ? 0 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Clarão branco no momento da troca. */}
      {phase === 'flash' && (
        <motion.div
          className="absolute inset-0 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0] }}
          transition={{ duration: (FLASH_END - STROBE_END) / 1000, times: [0, 0.35, 1] }}
        />
      )}

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative w-40 h-40 flex items-center justify-center">
          {!showNew ? (
            // Strobe clássico: a silhueta branca alternando com a forma real.
            <motion.img
              key="from"
              src={event.from.sprite}
              alt=""
              className="w-40 h-40 object-contain"
              animate={{
                scale: [1, 1.1, 1, 1.13, 1, 1.16, 1.02],
                filter: [
                  'brightness(1)',
                  'brightness(0) invert(1)',
                  'brightness(1)',
                  'brightness(0) invert(1)',
                  'brightness(1)',
                  'brightness(0) invert(1)',
                  'brightness(1)',
                ],
              }}
              transition={{ duration: STROBE_END / 1000, ease: 'easeInOut' }}
            />
          ) : (
            <motion.img
              key="to"
              src={event.to.sprite}
              alt=""
              className="w-40 h-40 object-contain drop-shadow-[0_8px_28px_rgba(245,158,11,0.35)]"
              initial={reduced ? { opacity: 1 } : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 16 }
              }
            />
          )}
        </div>

        <motion.p
          className="text-center text-sm text-text px-6"
          initial={{ opacity: 0, y: 8 }}
          animate={showNew ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.3 }}
        >
          O <span className="capitalize font-semibold">{event.from.name}</span> de{' '}
          <span className="font-semibold">{event.playerName}</span> evoluiu para{' '}
          <span className="capitalize font-semibold text-highlight">{event.to.name}</span>!
        </motion.p>
      </div>
    </motion.div>
  );
}

/**
 * Fila de evoluções da rodada.
 *
 * NÃO toca enquanto a coreografia de reveal do `PokerTable` estiver rodando —
 * as duas competiriam pela mesa. O sinal de fim vem de lá (`onCeremonyBusyChange`)
 * em vez de ser recalculado aqui: duplicar aquela aritmética de tempos seria a
 * garantia de dessincronizar na primeira mudança.
 *
 * Consequência desejada: uma escolha de pedra do Eevee fora de rodada toca na
 * hora, porque aí não há cerimônia em curso.
 */
export function EvolutionOverlay() {
  const queue = useRoomStore((s) => s.evolutionQueue);
  const ceremonyBusy = useRoomStore((s) => s.ceremonyBusy);
  const shiftEvolution = useRoomStore((s) => s.shiftEvolution);

  const [playing, setPlaying] = useState<EvolutionEvent | null>(null);
  const busyRef = useRef(false);

  // O pré-carregamento acontece AQUI, antes de montar a cena. Assim a cena nunca
  // precisa renderizar `null` enquanto espera — que era o que deixava nós órfãos
  // presos no DOM quando a saída era gerenciada por `AnimatePresence`.
  useEffect(() => {
    if (busyRef.current || ceremonyBusy || queue.length === 0) return;
    busyRef.current = true;
    const next = queue[0];
    let cancelled = false;
    void preload(next.to.sprite).then(() => {
      if (!cancelled) setPlaying(next);
    });
    return () => {
      cancelled = true;
    };
  }, [queue, ceremonyBusy]);

  const finish = useCallback(() => {
    setPlaying(null);
    busyRef.current = false;
    shiftEvolution();
  }, [shiftEvolution]);

  if (!playing) return null;
  return (
    <EvolutionScene key={`${playing.playerId}:${playing.seq}`} event={playing} onDone={finish} />
  );
}
