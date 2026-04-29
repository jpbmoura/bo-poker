import { cn } from '../../utils/cn';

interface PokeballIconProps {
  className?: string;
  size?: number;
  spinning?: boolean;
}

export function PokeballIcon({ className, size = 24, spinning = false }: PokeballIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(spinning && 'animate-spin-slow', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M2 12h20" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.5" fill="var(--bg)" />
    </svg>
  );
}
