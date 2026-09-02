import { io, Socket, type ManagerOptions, type SocketOptions } from 'socket.io-client';
import { SERVER_URL } from './auth';

let socket: Socket | null = null;

const options: Partial<ManagerOptions & SocketOptions> = {
  // A conexão NÃO pode começar junto com o app: o servidor exige sessão no
  // handshake, então quem conecta é o RequireAuth, depois da sessão resolver.
  autoConnect: false,
  transports: ['websocket', 'polling'],
  // Sem isto o cookie não vai junto quando o servidor está noutro subdomínio
  // (e o fallback de polling é XHR, que também depende disso).
  withCredentials: true,
};

export function getSocket(): Socket {
  if (!socket) {
    // Sem SERVER_URL o socket usa a própria origem — em dev o Vite faz o proxy.
    socket = SERVER_URL ? io(SERVER_URL, options) : io(options);
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
