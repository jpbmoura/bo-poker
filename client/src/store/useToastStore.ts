import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/** Mais que isso empilhado vira ruído; o mais antigo sai primeiro. */
const MAX_TOASTS = 3;
const DURATION_MS: Record<ToastKind, number> = {
  success: 2600,
  info: 3200,
  // Erro fica mais tempo: a pessoa precisa ler o que falhou.
  error: 5000,
};

interface ToastStoreState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],

  push: (kind, message) => {
    // Mesma mensagem já visível (clique repetido em "copiar"): não duplica.
    if (get().toasts.some((t) => t.message === message)) return;
    const id = nextId++;
    set((prev) => ({ toasts: [...prev.toasts, { id, kind, message }].slice(-MAX_TOASTS) }));
    window.setTimeout(() => get().dismiss(id), DURATION_MS[kind]);
  },

  dismiss: (id) => set((prev) => ({ toasts: prev.toasts.filter((t) => t.id !== id) })),
}));

/** Atalho para chamar fora de componentes (handlers, stores, catch). */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
};
