import { cn } from '../../utils/cn';

interface CaptureBallProps {
  size?: number;
  /** Botão do centro aceso — o "clique" de uma captura. */
  lit?: boolean;
  /** Pokébola já gasta: cinza. */
  spent?: boolean;
  className?: string;
}

/**
 * A Pokébola colorida da captura. O `PokeballIcon` é monocromático de propósito
 * (é marca/ícone); aqui ela é o objeto que se lança, então tem as cores.
 */
export function CaptureBall({ size = 48, lit = false, spent = false, className }: CaptureBallProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn(spent && 'grayscale opacity-30', className)}
      aria-hidden="true"
    >
      <path d="M4 24a20 20 0 0 1 40 0z" fill="#EF4444" />
      <path d="M4 24a20 20 0 0 0 40 0z" fill="#F4F4F5" />
      <circle cx="24" cy="24" r="20" fill="none" stroke="#18181B" strokeWidth="3" />
      <path d="M4 24h40" stroke="#18181B" strokeWidth="3" />
      <circle cx="24" cy="24" r="6.5" fill="#F4F4F5" stroke="#18181B" strokeWidth="3" />
      <circle
        cx="24"
        cy="24"
        r="3"
        fill={lit ? '#FBBF24' : '#E4E4E7'}
        style={{ transition: 'fill 150ms' }}
      />
      <path d="M11 15a15 15 0 0 1 8-6" stroke="#fff" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
