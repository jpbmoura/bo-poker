import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

/**
 * Sem `baseURL` de propósito: o default é `window.location.origin`, então as
 * chamadas saem relativas para `/api/auth/*`. Em dev o Vite faz o proxy para a
 * :3001 e em produção é a mesma origem — nos dois casos nenhum CORS entra na
 * jogada e o cookie de sessão viaja normalmente.
 */
export const authClient = createAuthClient({
  plugins: [
    // Espelha o additionalFields declarado no servidor para o tipo do usuário
    // no cliente incluir o handle do GitHub.
    inferAdditionalFields({
      user: {
        login: { type: 'string', required: false },
      },
    }),
  ],
});

export const { useSession, signIn, signOut, updateUser } = authClient;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  login?: string | null;
};

/**
 * O `callbackURL` precisa ser ABSOLUTO. Um caminho relativo é resolvido contra
 * o `baseURL` do servidor (:3001 em dev), que não serve o client — o usuário
 * cairia num 404 depois do login.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}
