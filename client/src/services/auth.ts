import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

/** Origem do servidor. Vazia em dev (Vite faz proxy e tudo é same-origin). */
export const SERVER_URL = import.meta.env.VITE_SERVER_URL?.trim() || '';

/**
 * Sem `VITE_SERVER_URL`, a `baseURL` fica indefinida e o cliente usa caminhos
 * relativos (`/api/auth/*`) — é o caso de dev, com o proxy do Vite.
 *
 * Com ela, o Better Auth acrescenta `/api/auth` sozinho e manda
 * `credentials: 'include'` por padrão. Para o cookie chegar, o servidor precisa
 * de CORS com credenciais liberando exatamente a origem do cliente
 * (`CORS_ORIGIN`) — e os dois precisam ser subdomínios do mesmo domínio raiz.
 */
export const authClient = createAuthClient({
  ...(SERVER_URL ? { baseURL: SERVER_URL } : {}),
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
