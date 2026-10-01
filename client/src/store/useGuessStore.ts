import { create } from 'zustand';
import { getDailyGuess, type DailyGuess } from '../services/guess';
import { toast } from './useToastStore';

interface GuessStoreState {
  guess: DailyGuess | null;
  /** Falhou a leitura: a aba some em vez de mostrar dado errado. */
  failed: boolean;
  load: () => Promise<void>;
  set: (guess: DailyGuess) => void;
}

let inFlight: Promise<void> | null = null;

export const useGuessStore = create<GuessStoreState>((set) => ({
  guess: null,
  failed: false,

  load: async () => {
    if (inFlight) return inFlight;
    inFlight = getDailyGuess()
      .then((guess) => set({ guess, failed: false }))
      .catch(() => {
        set({ failed: true });
        toast.error('O "Quem é esse Pokémon?" não carregou. Tente de novo mais tarde.');
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },

  set: (guess) => set({ guess, failed: false }),
}));
