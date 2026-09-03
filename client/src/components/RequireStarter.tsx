import { Outlet } from 'react-router-dom';
import { useTrainer } from '../hooks/useTrainer';
import StarterPage from '../pages/StarterPage';
import { PokeballIcon } from './ui/PokeballIcon';

/**
 * Portão de inicial. Fica DENTRO do `RequireAuth` para a sessão já ter
 * resolvido e o socket já estar conectando.
 *
 * Duas decisões load-bearing:
 *
 * 1. Renderiza a escolha NO LUGAR do `<Outlet />` em vez de redirecionar. Assim
 *    a rota original — inclusive um link de sala — é preservada, e a pessoa cai
 *    na sala certa assim que escolhe.
 *
 * 2. **Falha ABERTO** quando a busca não responde (503, rede). É a mesma regra
 *    que o `metaState` da RoomPage já segue ("só o 404 bloqueia"): falhar fechado
 *    trancaria todo mundo fora de salas VIVAS por causa de um blip do Postgres,
 *    que é exatamente a invariante do projeto. O servidor falha macio do outro
 *    lado — quem entra sem Pokémon joga com a Pokébola e ganha 0 XP.
 */
export function RequireStarter() {
  const { status, needsStarter } = useTrainer();

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-screen bg-dot-grid flex items-center justify-center">
        <PokeballIcon spinning size={28} className="text-muted/60" />
      </div>
    );
  }

  if (needsStarter) return <StarterPage />;

  return <Outlet />;
}
