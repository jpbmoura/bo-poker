import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // A conexão NÃO pode começar junto com o app: o servidor exige sessão no
      // handshake, então quem conecta é o RequireAuth, depois da sessão resolver.
      autoConnect: false,
      transports: ['websocket', 'polling'],
      // O fallback de polling é XHR e não manda cookie sem isto.
      withCredentials: true,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  // `connect()` já é no-op quando conectado — seguro sob o duplo-invoke do
  // StrictMode.
  if (!s.connected) s.connect();
}

/**
 * Fecha a conexão sem anular a variável de módulo: componentes montados seguram
 * a instância via `useState(getSocket)` e ficariam com um socket morto para
 * sempre. O sign-out termina com um `location.assign`, que zera tudo de fato.
 */
export function disconnectSocket(): void {
  socket?.disconnect();
}
