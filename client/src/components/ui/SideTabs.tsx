import type { ReactNode } from 'react';

/**
 * A coluna de "orelhas" presa à borda direita, como as abas de um fichário.
 * Cada atividade diária é um filho; a coluna inteira fica centralizada.
 */
export function SideTabs({ children }: { children: ReactNode }) {
  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-2">
      {children}
    </div>
  );
}
