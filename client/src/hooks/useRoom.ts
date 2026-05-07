import { useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { useSocket } from './useSocket';
import type { CardValue, PlayerRole, Pokemon, RoomError, RoomState } from '../types';

const Events = {
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  VOTE_CAST: 'vote:cast',
  VOTE_REVEAL: 'vote:reveal',
  VOTE_RESET: 'vote:reset',
  PLAYER_SET_ROLE: 'player:setRole',
  ROOM_CLEAR_INACTIVE: 'room:clearInactive',
  ROOM_STATE: 'room:state',
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
} as const;

export function useRoom(roomId: string) {
  const { socket } = useSocket();
  const setRoomState = useRoomStore((s) => s.setRoomState);
  const setMyPlayerId = useRoomStore((s) => s.setMyPlayerId);
  const setError = useRoomStore((s) => s.setError);
  const setJoined = useRoomStore((s) => s.setJoined);
  const setJoining = useRoomStore((s) => s.setJoining);

  useEffect(() => {
    const onState = (state: RoomState) => setRoomState(state);
    const onJoined = ({ playerId }: { playerId: string }) => {
      setMyPlayerId(playerId);
      setJoined(true);
      setJoining(false);
      setError(null);
    };
    const onError = (err: RoomError) => {
      setError(err);
      setJoining(false);
    };

    socket.on(Events.ROOM_STATE, onState);
    socket.on(Events.ROOM_JOINED, onJoined);
    socket.on(Events.ROOM_ERROR, onError);

    return () => {
      socket.off(Events.ROOM_STATE, onState);
      socket.off(Events.ROOM_JOINED, onJoined);
      socket.off(Events.ROOM_ERROR, onError);
    };
  }, [socket, roomId, setRoomState, setMyPlayerId, setJoined, setJoining, setError]);

  // Auto-rejoin on reconnection if user already entered
  useEffect(() => {
    const onConnect = () => {
      const { joined, myName, myPokemon, myRole } = useRoomStore.getState();
      if (joined && myName && myPokemon) {
        socket.emit(Events.ROOM_JOIN, {
          roomId,
          name: myName,
          pokemon: myPokemon,
          role: myRole,
        });
      }
    };
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, roomId]);

  const join = (name: string, pokemon: Pokemon, role: PlayerRole) => {
    setJoining(true);
    setError(null);
    socket.emit(Events.ROOM_JOIN, { roomId, name, pokemon, role });
  };

  const leave = () => {
    socket.emit(Events.ROOM_LEAVE);
  };

  const castVote = (value: CardValue) => {
    socket.emit(Events.VOTE_CAST, { value });
  };

  const reveal = () => {
    socket.emit(Events.VOTE_REVEAL);
  };

  const reset = () => {
    socket.emit(Events.VOTE_RESET);
  };

  const setRole = (role: PlayerRole) => {
    socket.emit(Events.PLAYER_SET_ROLE, { role });
  };

  const clearInactive = () => {
    socket.emit(Events.ROOM_CLEAR_INACTIVE);
  };

  return { join, leave, castVote, reveal, reset, setRole, clearInactive };
}
