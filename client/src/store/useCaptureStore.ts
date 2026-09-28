import { create } from 'zustand';
import { getDailyCapture, type DailyCapture } from '../services/capture';

interface CaptureStoreState {
  capture: DailyCapture | null;
  /** Falhou a leitura: a aba some em vez de mostrar dado errado. */
  failed: boolean;
  load: () => Promise<void>;
  set: (capture: DailyCapture) => void;
}

let inFlight: Promise<void> | null = null;

export const useCaptureStore = create<CaptureStoreState>((set) => ({
  capture: null,
  failed: false,

  load: async () => {
    if (inFlight) return inFlight;
    inFlight = getDailyCapture()
      .then((capture) => set({ capture, failed: false }))
      .catch(() => set({ failed: true }))
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },

  set: (capture) => set({ capture, failed: false }),
}));
