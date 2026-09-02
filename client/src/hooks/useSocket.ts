import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';

export function useSocket(): { socket: Socket; connected: boolean } {
  // `useState(getSocket)` e nao `getSocket()`: chamar no corpo do render abre
  // conexao durante a renderizacao.
  const [socket] = useState(getSocket);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    // Ressincroniza antes de escutar: o valor inicial foi amostrado no primeiro
    // render e o listener so entra aqui -- um `connect` que caia nessa fresta
    // deixava o banner "Reconectando ao servidor..." preso para sempre.
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  return { socket, connected };
}
