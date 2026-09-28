import { PokeballIcon } from './PokeballIcon';

/** Carregamento de tela inteira: a Pokébola sozinha não dizia O QUE carregava. */
export function FullScreenLoader({ label }: { label: string }) {
  return (
    <div
      className="min-h-screen bg-dot-grid flex flex-col items-center justify-center gap-3 animate-fade-in"
      role="status"
    >
      <PokeballIcon spinning size={28} className="text-muted/60" />
      <span className="text-xs text-subtle">{label}</span>
    </div>
  );
}
