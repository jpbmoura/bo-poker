import { create } from 'zustand';
import { getTrainer, type TrainerCollection, type TrainerPokemon } from '../services/trainer';
import { toast } from './useToastStore';

/**
 * `unavailable` é diferente de "coleção vazia": vazia significa "escolha um
 * inicial", indisponível significa "o banco piscou". Confundir os dois faria um
 * blip do Postgres parecer perda de progresso.
 */
export type TrainerStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

interface TrainerStoreState {
  collection: TrainerCollection | null;
  status: TrainerStatus;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  apply: (collection: TrainerCollection) => void;
  clear: () => void;
}

/**
 * Deduplica a requisição em voo no nível do MÓDULO: a montagem da página e o
 * portão de rota podem pedir juntos, e uma busca basta.
 */
let inFlight: Promise<void> | null = null;

export const useTrainerStore = create<TrainerStoreState>((set, get) => ({
  collection: null,
  status: 'idle',

  load: async () => {
    if (get().status === 'ready') return;
    if (inFlight) return inFlight;
    set({ status: 'loading' });
    inFlight = getTrainer()
      .then((collection) => {
        set({ collection, status: 'ready' });
      })
      .catch(() => {
        // Não distingue 401 aqui: sem sessão o RequireAuth já redirecionou.
        set({ status: 'unavailable' });
        toast.error('Não foi possível carregar seus Pokémon agora. Recarregue a página em instantes.');
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },

  reload: async () => {
    set({ status: 'idle' });
    return get().load();
  },

  apply: (collection) => set({ collection, status: 'ready' }),
  clear: () => set({ collection: null, status: 'idle' }),
}));

/** O Pokémon que aparece na mesa. Null enquanto a coleção estiver vazia. */
export function activeOf(collection: TrainerCollection | null): TrainerPokemon | null {
  if (!collection) return null;
  return (
    collection.pokemon.find((p) => p.id === collection.activeId) ??
    collection.pokemon[0] ??
    null
  );
}
