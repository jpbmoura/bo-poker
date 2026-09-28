import { AnimationEvent, useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';
import type { CardValue } from '../types';

interface CardDeckProps {
  sequence: CardValue[];
  selected: CardValue | null;
  disabled: boolean;
  onSelect: (value: CardValue) => void;
}

export function CardDeck({ sequence, selected, disabled, onSelect }: CardDeckProps) {
  const [picking, setPicking] = useState<CardValue | null>(null);

  // Rede de seguranca do latch. `animationend` e o caminho normal, mas se ele
  // nao chegar (aba em background, animacao interrompida por troca de classe, o
  // no saindo do DOM) a carta ficaria destacada para SEMPRE -- inclusive na
  // rodada seguinte, ja zerada. `selected` so faz a transicao preenchido -> nulo
  // quando a rodada e resetada; no clique ela vai de nulo para nulo (o servidor
  // ainda nao respondeu), entao isto nunca corta um `card-pick` em andamento.
  const prevSelected = useRef(selected);
  useEffect(() => {
    if (prevSelected.current !== null && selected === null) setPicking(null);
    prevSelected.current = selected;
  }, [selected]);

  const handleSelect = (value: CardValue) => {
    if (disabled) return;
    // Reclicar a carta ja destacada precisa reenviar: se o voto anterior foi
    // recusado pelo servidor, este era o unico jeito de tentar de novo.
    setPicking(value);
    onSelect(value);
  };

  const handleAnimationEnd = (value: CardValue, e: AnimationEvent<HTMLButtonElement>) => {
    if (e.animationName === 'card-pick' && picking === value) {
      setPicking(null);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 animate-fade-up">
      {sequence.map((value, idx) => {
        const isSelected = selected === value;
        const isPicking = picking === value;
        const isSymbol = value === '?';
        const isDimmed = selected !== null && !isSelected && !isPicking;

        const selectedShadow =
          'shadow-[0_0_0_2px_rgb(var(--text)),0_22px_50px_-12px_rgba(255,255,255,0.42)]';

        return (
          // A entrada escalonada mora AQUI, e nao no botao, porque `animate-*`
          // escreve a shorthand `animation`: duas dessas classes na mesma tag
          // colidem e vence a que o Tailwind emitir por ultimo (ordem alfabetica
          // no CSS gerado, nao a ordem do className). Com `animate-fade-up` no
          // botao, `.animate-fade-up` vinha depois de `.animate-card-pick` e o
          // pick nunca rodava -- logo o `animationend` nunca chegava e o latch
          // `picking` ficava preso, matando "Sua carta", o halo e o float.
          // O `z-10` tambem mora aqui: o `fade-up` usa fill `both`, entao o
          // transform retido cria um stacking context e isolaria um z-index
          // aplicado no botao. Flex item aceita `z-index` sem `position`.
          <div
            key={value}
            style={{ animationDelay: `${idx * 30}ms` }}
            className={cn('animate-fade-up', (isSelected || isPicking) && 'z-10')}
          >
            <button
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={isSymbol ? 'Votar: não sei' : `Votar ${value}`}
              onClick={() => handleSelect(value)}
              onAnimationEnd={(e) => handleAnimationEnd(value, e)}
              className={cn(
                'group relative w-16 h-24 rounded-lg border bg-surface-2 flex items-center justify-center',
                'will-change-transform',
                !isPicking &&
                  'transition-[transform,box-shadow,opacity,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                !disabled && !isSelected && !isPicking &&
                  'hover:-translate-y-1.5 hover:bg-surface-3 cursor-pointer active:scale-[0.96] active:translate-y-0',
                disabled && !isSelected && 'opacity-30 cursor-not-allowed',
                isDimmed && !disabled && 'opacity-60',
                isPicking && `animate-card-pick border-text bg-surface-3 ${selectedShadow}`,
                isSelected && !isPicking &&
                  // Sem motion: mesma pose, parada.
                  `motion-safe:animate-selected-float motion-reduce:-translate-y-5 motion-reduce:scale-110 border-text bg-surface-3 ${selectedShadow}`,
                !isSelected && !isPicking && 'border-border hover:border-border-strong',
              )}
            >
              {isSelected && !isPicking && (
                <span
                  aria-hidden
                  className="absolute -inset-2 rounded-2xl bg-text/15 blur-xl motion-safe:animate-selected-halo motion-reduce:opacity-40 pointer-events-none -z-10"
                />
              )}

              <span
                className={cn(
                  'text-2xl font-mono font-medium transition-colors duration-200',
                  isSelected || isPicking ? 'text-text' : 'text-muted group-hover:text-text',
                  isSymbol && 'font-sans text-xl',
                )}
              >
                {value}
              </span>

              {isSelected && !isPicking && (
                <>
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.18em] font-mono font-semibold text-text whitespace-nowrap animate-fade-in">
                    Sua carta
                  </span>
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-text shadow-[0_0_10px_rgb(var(--text))]" />
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
