import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'solid';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-surface-2 text-text border border-border-strong hover:bg-surface-3 hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed',
  solid:
    'bg-text text-bg hover:bg-text/90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold',
  secondary:
    'bg-transparent text-muted border border-border hover:bg-surface-2 hover:text-text hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40 disabled:cursor-not-allowed',
  danger:
    'bg-transparent text-danger border border-transparent hover:bg-danger-soft hover:border-danger/30 disabled:opacity-40 disabled:cursor-not-allowed',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-sm rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'active:scale-[0.97] disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});
