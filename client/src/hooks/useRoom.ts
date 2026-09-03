import { useCallback, useEffect, useRef } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { useSocket } from './useSocket';
import { readSession, writeSession } from '../services/session';
import { useSession } from '../services/auth';
import type {
  CardValue,
  JoinedPayload,
  PlayerRole,
  Pokemon,
  RoomClosedPayload,
  RoomError,
  RoomState,
} from '../types';

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
  // ATENÇÃO: este mapa é uma cópia de server/src/socket/events.ts e NADA testa a
  // sincronia dos dois. Esquecer um nome aqui faz o listener nunca disparar.
  ROOM_CLOSED: 'room:closed',
} as const;

const JOIN_TIMEOUT_MS = 10_000;

export function useRoom(roomId: string) {
  const { socket } = useSocket();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const setRoomState = useRoomStore((s) => s.setRoomState);
  const setMyPlayerId = useRoomStore((s) => s.setMyPlayerId);
  const setError = useRoomStore((s) => s.setError);
  const setJoined = useRoomStore((s) => s.setJoined);
  const setJoining = useRoomStore((s) => s.setJoining);
  const setClosed = useRoomStore((s) => s.setClosed);

  const joinTimeoutRef = useRef<number | null>(null);

  const clearJoinTimeout = useCallback(() => {
    if (joinTimeoutRef.current !== null) {
      window.clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onState = (state: RoomState) => setRoomState(state);

    const onJoined = ({ playerId }: JoinedPayload) => {
      clearJoinTimeout();
      setMyPlayerId(playerId);
      setJoined(true);
      setJoining(false);
      setError(null);
    };

    const onError = (err: RoomError) => {
      clearJoinTimeout();
      setError(err);
      setJoining(false);
      // Sem isto o usuario ficava numa sessao zumbi: via a sala normal, sem
      // mensagem de erro, e todos os votos seguintes eram descartados.
      if (err.code === 'NOT_IN_ROOM' || err.code === 'SESSION_EXPIRED') {
        setJoined(false);
        setMyPlayerId(null);
      }
    };

    // A sala deixou de existir. Só registra o fato: quem navega é a RoomPage,
    // pelo mesmo motivo de `error` — o hook não conhece rotas.
    const onClosed = (payload: RoomClosedPayload) => {
      clearJoinTimeout();
      setJoined(false);
      setJoining(false);
      setMyPlayerId(null);
      setClosed(payload);
    };

    socket.on(Events.ROOM_STATE, onState);
    socket.on(Events.ROOM_JOINED, onJoined);
    socket.on(Events.ROOM_ERROR, onError);
    socket.on(Events.ROOM_CLOSED, onClosed);

    return () => {
      socket.off(Events.ROOM_STATE, onState);
      socket.off(Events.ROOM_JOINED, onJoined);
      socket.off(Events.ROOM_ERROR, onError);
      socket.off(Events.ROOM_CLOSED, onClosed);
      clearJoinTimeout();
    };
  }, [
    socket,
    roomId,
    clearJoinTimeout,
    setRoomState,
    setMyPlayerId,
    setJoined,
    setJoining,
    setError,
    setClosed,
  ]);

  const emitJoin = useCallback(
    (name: string, pokemon: Pokemon, role: PlayerRole) => {
      // `joining` funciona como trava de join em voo: a reentrada automatica e
      // a montagem da pagina podem disparar juntas, e um join basta.
      if (useRoomStore.getState().joining) return;
      if (userId) writeSession(userId, roomId, { name, pokemon, role });
      setJoining(true);
      setError(null);
      clearJoinTimeout();
      // O emit fica em buffer se o socket estiver caido; sem timeout o botao
      // ficava em "Entrando..." eternamente.
      joinTimeoutRef.current = window.setTimeout(() => {
        joinTimeoutRef.current = null;
        if (!useRoomStore.getState().joined) {
          setJoining(false);
          setError({
            code: 'INVALID_ROOM',
            message: 'Não foi possível entrar na sala. Verifique sua conexão.',
          });
        }
      }, JOIN_TIMEOUT_MS);

      // Sem identidade no payload: quem e o jogador vem da sessao do socket.
      socket.emit(Events.ROOM_JOIN, { roomId, name, pokemon, role });
    },
    [socket, roomId, userId, clearJoinTimeout, setError, setJoining],
  );

  // Reentrada automatica apos reconexao. Agora e idempotente: o servidor religa
  // o assento existente em vez de criar um novo.
  useEffect(() => {
    const onConnect = () => {
      const { joined, myName, myPokemon, myRole } = useRoomStore.getState();
      const stored = userId ? readSession(userId, roomId) : null;
      const name = myName ?? stored?.name;
      const pokemon = myPokemon ?? stored?.pokemon;
      const role = myName ? myRole : stored?.role;
      if ((joined || stored) && name && pokemon) {
        emitJoin(name, pokemon, role ?? 'voter');
      }
    };
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, roomId, userId, emitJoin]);

  const join = emitJoin;

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
