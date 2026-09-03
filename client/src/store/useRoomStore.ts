import { create } from 'zustand';
import type {
  EvolutionEvent,
  PlayerRole,
  RoomClosedPayload,
  RoomError,
  RoomState,
  RoundResultPayload,
} from '../types';

/** Meia mesa evoluindo na mesma rodada é improvável; a fila não precisa crescer. */
const MAX_EVOLUTION_QUEUE = 4;

interface RoomStoreState {
  roomState: RoomState | null;
  myPlayerId: string | null;
  myName: string | null;
  myRole: PlayerRole;
  joining: boolean;
  joined: boolean;
  error: RoomError | null;
  /** A sala foi excluída enquanto a pessoa estava dentro. A navegação fica na
   *  RoomPage, igual ao `error` — o hook só registra o fato. */
  closed: RoomClosedPayload | null;

  /** Resultado de XP da rodada revelada. Vem do servidor, nunca recalculado. */
  roundResult: RoundResultPayload | null;
  /** Evoluções esperando para tocar, em ordem de chegada. */
  evolutionQueue: EvolutionEvent[];
  /**
   * A coreografia de reveal do PokerTable ainda está rodando. O overlay de
   * evolução só drena a fila quando isto está desligado — senão as duas
   * animações competiriam pela mesa.
   */
  ceremonyBusy: boolean;

  setRoomState: (state: RoomState | null) => void;
  setMyPlayerId: (id: string | null) => void;
  setEntryData: (data: { name: string; role: PlayerRole }) => void;
  setRole: (role: PlayerRole) => void;
  setJoining: (joining: boolean) => void;
  setJoined: (joined: boolean) => void;
  setError: (error: RoomError | null) => void;
  setClosed: (closed: RoomClosedPayload | null) => void;
  setRoundResult: (result: RoundResultPayload | null) => void;
  pushEvolution: (evolution: EvolutionEvent) => void;
  shiftEvolution: () => void;
  setCeremonyBusy: (busy: boolean) => void;
  reset: () => void;
}

/**
 * O que morre com a rodada. A `evolutionQueue` NÃO está aqui de propósito: uma
 * evolução é um marco da conta, não estado de rodada. Limpá-la no reset
 * descartaria em silêncio a evolução de quem clicou "Nova rodada" antes de a
 * animação ter chance de tocar — ela espera a mesa ficar livre e toca depois.
 */
const NEW_ROUND = {
  roundResult: null,
  ceremonyBusy: false,
};

const EMPTY_ROUND = {
  ...NEW_ROUND,
  evolutionQueue: [] as EvolutionEvent[],
};

export const useRoomStore = create<RoomStoreState>((set) => ({
  roomState: null,
  myPlayerId: null,
  myName: null,
  myRole: 'voter',
  joining: false,
  joined: false,
  error: null,
  closed: null,
  ...EMPTY_ROUND,

  // Nova rodada zera o que era da rodada anterior. Ancorar no `revealed` do
  // servidor evita depender de um evento de reset chegar antes do estado.
  setRoomState: (roomState) =>
    set((prev) =>
      roomState && !roomState.revealed && prev.roomState?.revealed
        ? { roomState, ...NEW_ROUND }
        : { roomState },
    ),
  setMyPlayerId: (myPlayerId) => set({ myPlayerId }),
  setEntryData: ({ name, role }) => set({ myName: name, myRole: role }),
  setRole: (myRole) => set({ myRole }),
  setJoining: (joining) => set({ joining }),
  setJoined: (joined) => set({ joined }),
  setError: (error) => set({ error }),
  setClosed: (closed) => set({ closed }),

  setRoundResult: (roundResult) => set({ roundResult }),
  pushEvolution: (evolution) =>
    set((prev) =>
      prev.evolutionQueue.length >= MAX_EVOLUTION_QUEUE
        ? prev
        : { evolutionQueue: [...prev.evolutionQueue, evolution] },
    ),
  shiftEvolution: () => set((prev) => ({ evolutionQueue: prev.evolutionQueue.slice(1) })),
  setCeremonyBusy: (ceremonyBusy) => set({ ceremonyBusy }),

  reset: () =>
    set({
      roomState: null,
      myPlayerId: null,
      myName: null,
      myRole: 'voter',
      joining: false,
      joined: false,
      error: null,
      closed: null,
      ...EMPTY_ROUND,
    }),
}));
