import { SERVER_URL } from './auth';

/**
 * Carrega o status para a UI distinguir "não existe" (404) de "banco fora"
 * (503). A diferença é load-bearing: o portão de inicial precisa mostrar a tela
 * de escolha no primeiro caso e uma tela de "tente de novo" no segundo, senão um
 * blip do Postgres faria a pessoa achar que perdeu o Pokémon.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // SERVER_URL é vazia em dev (o Vite faz o proxy) e só existe no arranjo de
  // domínios separados. `credentials: 'include'` é obrigatório: a autorização
  // é o cookie de sessão, igual ao `withCredentials` do socket.
  const res = await fetch(`${SERVER_URL}${path}`, {
    credentials: 'include',
    ...init,
  });

  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.error === 'string') code = body.error;
    } catch {
      // Resposta sem JSON (proxy, gateway): o status já basta.
    }
    throw new ApiError(res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Mutação sempre com JSON: força o preflight que o `cors()` do servidor filtra. */
export const mutation = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
