import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../services/auth';
import { connectSocket, getSocket } from '../services/socket';
import { FullScreenLoader } from './ui/FullScreenLoader';

/**
 * Portão de sessão e shell do app — antes disto não existia nenhum layout
 * compartilhado. Também é o único lugar que conecta o socket: o handshake só
 * pode acontecer depois que a sessão resolveu.
 */
export function RequireAuth() {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const userId = session?.user?.id ?? null;
  const knownUserRef = useRef<string | null>(null);

  // Login como outra pessoa em outra aba: o cookie é do navegador, não da aba,
  // então esta aba passaria a operar com a identidade nova segurando o assento
  // da antiga. Recarregar zera todo o estado de módulo de uma vez.
  useEffect(() => {
    if (!userId) return;
    if (knownUserRef.current === null) {
      knownUserRef.current = userId;
      return;
    }
    if (knownUserRef.current !== userId) {
      window.location.reload();
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    connectSocket();
    // Sem cleanup de propósito: desconectar aqui derrubaria a conexão a cada
    // remontagem simulada do StrictMode.
  }, [userId]);

  // O socket.io-client NÃO tenta reconectar depois de um connect_error (ele
  // chama destroy() antes de emitir), então sessão inválida é estado terminal:
  // sem isto o usuário ficaria preso para sempre no banner "Reconectando...".
  useEffect(() => {
    const socket = getSocket();
    const onConnectError = (err: Error) => {
      if (err.message === 'UNAUTHENTICATED') {
        navigate('/login', { replace: true, state: { from: location.pathname } });
      }
    };
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('connect_error', onConnectError);
    };
  }, [navigate, location.pathname]);

  if (isPending) {
    return <FullScreenLoader label="Verificando sua sessão…" />;
  }

  if (!session) {
    // Preserva o destino: redirecionar sem isto perderia o link da sala.
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
