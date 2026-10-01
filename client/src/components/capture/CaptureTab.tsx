import { cn } from '../../utils/cn';
import type { DailyCapture } from '../../services/capture';

interface CaptureTabProps {
  capture: DailyCapture;
  onOpen: () => void;
}

const LABEL: Record<DailyCapture['status'], string> = {
  available: 'Captura disponível',
  caught: 'Capturado!',
  fled: 'Fugiu · volte amanhã',
};

/**
 * A "orelha" na borda direita da home. Só pulsa quando ainda dá para tentar —
 * nos outros estados continua lá, discreta, para a pessoa ver o do dia.
 */
export function CaptureTab({ capture, onOpen }: CaptureTabProps) {
  const available = capture.status === 'available';
  return (
    <button
      type="button"
      onClick={onOpen}
      title={LABEL[capture.status]}
      className={cn(
        'fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 py-3 pl-2 pr-1.5',
        'rounded-l-xl border border-r-0 bg-surface transition-all hover:pr-3 animate-fade-in',
        available ? 'border-highlight/50 motion-safe:animate-pulse-glow' : 'border-border',
      )}
    >
      <img
        src={capture.species.sprite}
        alt=""
        className={cn('w-10 h-10 object-contain', !available && 'opacity-60 grayscale')}
      />
      <span
        className={cn(
          'text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180',
          available ? 'text-highlight' : 'text-muted',
        )}
      >
        {LABEL[capture.status]}
      </span>
    </button>
  );
}
