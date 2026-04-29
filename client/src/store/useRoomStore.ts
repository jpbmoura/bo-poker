import { create } from 'zustand';
import type { Pokemon, PlayerRole, RoomError, RoomState } from '../types';

interface RoomStoreState {
  roomState: RoomState | null;
  myPlayerId: string | null;
  myPokemon: Pokemon | null;
  myName: string | null;
  myRole: PlayerRole;
  joining: boolean;
  joined: boolean;
  error: RoomError | null;

  setRoomState: (state: RoomState | null) => void;
  setMyPlayerId: (id: string | null) => void;
  setEntryData: (data: { name: string; pokemon: Pokemon; role: PlayerRole }) => void;
  setRole: (role: PlayerRole) => void;
  setJoining: (joining: boolean) => void;
  setJoined: (joined: boolean) => void;
  setError: (error: RoomError | null) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  roomState: null,
  myPlayerId: null,
  myPokemon: null,
  myName: null,
  myRole: 'voter',
  joining: false,
  joined: false,
  error: null,

  setRoomState: (roomState) => set({ roomState }),
  setMyPlayerId: (myPlayerId) => set({ myPlayerId }),
  setEntryData: ({ name, pokemon, role }) =>
    set({ myName: name, myPokemon: pokemon, myRole: role }),
  setRole: (myRole) => set({ myRole }),
  setJoining: (joining) => set({ joining }),
  setJoined: (joined) => set({ joined }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      roomState: null,
      myPlayerId: null,
      myPokemon: null,
      myName: null,
      myRole: 'voter',
      joining: false,
      joined: false,
      error: null,
    }),
}));
