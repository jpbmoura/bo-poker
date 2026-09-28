import { useEffect, useRef, useState } from 'react';
import { Link2, Settings, LogOut, Check, Eraser, Star } from 'lucide-react';
import { cn } from '../utils/cn';
import { PokeballIcon } from './ui/PokeballIcon';

interface IconSidebarProps {
  onCopyLink: () => Promise<boolean> | boolean;
  onOpenSettings: () => void;
  onClearInactive: () => void;
  onLeave: () => void;
  onHome: () => void;
  onToggleFavorite: () => void;
  hasInactive: boolean;
  isFavorite: boolean;
}

export function IconSidebar({
  onCopyLink,
  onOpenSettings,
  onClearInactive,
  onLeave,
  onHome,
  onToggleFavorite,
  hasInactive,
  isFavorite,
}: IconSidebarProps) {
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);

  // Ambos os timers vazavam: setState depois do unmount se a pessoa saisse da
  // sala dentro dos 1,5s do feedback.
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    },
    [],
  );

  const handleCopy = async () => {
    const ok = await onCopyLink();
    if (ok) {
      setCopied(true);
      timers.current.push(window.setTimeout(() => setCopied(false), 1500));
    }
  };

  const handleClear = () => {
    if (!hasInactive) return;
    onClearInactive();
    setCleared(true);
    timers.current.push(window.setTimeout(() => setCleared(false), 1500));
  };

  return (
    <aside className="fixed left-0 top-0 z-20 h-full w-14 flex flex-col items-center py-4 border-r border-border bg-surface/40 backdrop-blur animate-fade-in">
      <button
        onClick={onHome}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-all active:scale-90"
        title="Início"
      >
        <PokeballIcon size={18} className="text-brand" />
      </button>

      <div className="my-3 w-6 h-px bg-border" />

      <SidebarButton onClick={handleCopy} title={copied ? 'Link copiado' : 'Copiar link'}>
        {copied ? (
          <Check size={16} className="text-success animate-fade-in" />
        ) : (
          <Link2 size={16} />
        )}
      </SidebarButton>

      {/* Aqui o ícone É o estado (preenchido vs. contorno), então não precisa do
          swap para Check que os outros botões usam como feedback. */}
      <SidebarButton
        onClick={onToggleFavorite}
        title={isFavorite ? 'Remover dos favoritos' : 'Favoritar sala'}
      >
        <Star
          size={16}
          fill={isFavorite ? 'currentColor' : 'none'}
          className={cn(isFavorite && 'text-highlight')}
        />
      </SidebarButton>

      <SidebarButton
        onClick={handleClear}
        title={
          !hasInactive
            ? 'Sem jogadores inativos'
            : cleared
              ? 'Inativos removidos'
              : 'Limpar inativos'
        }
        disabled={!hasInactive}
      >
        {cleared ? (
          <Check size={16} className="text-success animate-fade-in" />
        ) : (
          <Eraser size={16} />
        )}
      </SidebarButton>

      <SidebarButton onClick={onOpenSettings} title="Configurações">
        <Settings size={16} />
      </SidebarButton>

      <div className="flex-1" />

      <SidebarButton onClick={onLeave} title="Sair da sala" danger>
        <LogOut size={16} />
      </SidebarButton>
    </aside>
  );
}

function SidebarButton({
  children,
  onClick,
  title,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 mb-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/70',
        !disabled && 'active:scale-90',
        disabled && 'opacity-30 cursor-not-allowed',
        !disabled && (danger
          ? 'text-muted hover:bg-danger-soft hover:text-danger'
          : 'text-muted hover:bg-surface-2 hover:text-text'),
        disabled && 'text-subtle',
      )}
    >
      {children}
    </button>
  );
}
