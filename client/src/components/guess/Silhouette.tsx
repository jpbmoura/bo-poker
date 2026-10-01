import { cn } from '../../utils/cn';
import { silhouetteUrl } from '../../services/guess';

/**
 * A silhueta do dia como máscara: o PNG chega preto do servidor e aqui ganha a
 * cor do texto, então fica legível no tema claro e no escuro.
 */
export function Silhouette({ day, className }: { day: string; className?: string }) {
  const url = `url(${silhouetteUrl(day)})`;
  return (
    <div
      role="img"
      aria-label="Silhueta do Pokémon misterioso"
      className={cn('bg-text', className)}
      style={{
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}
