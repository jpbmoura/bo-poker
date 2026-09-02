import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { config } from './config.js';

/**
 * Pool compartilhado. O Better Auth é o ÚNICO consumidor do Postgres — o
 * estado das salas continua em memória, então uma oscilação do banco não pode
 * derrubar uma rodada em andamento (ver /health em index.ts).
 */
const host = (() => {
  try {
    return new URL(config.databaseUrl).hostname;
  } catch {
    return '';
  }
})();
// Postgres local e a rede interna do Railway falam sem TLS; qualquer outro
// host (proxy público, Neon, Supabase) exige. Derivado do host em vez de
// hardcoded para não quebrar ao trocar de provedor.
const needsSsl = host !== '' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) &&
  !host.endsWith('.railway.internal');

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

/**
 * OBRIGATÓRIO. Um cliente ocioso do pool emite 'error' quando o Postgres cai,
 * e sem listener isso é um 'error' não tratado num EventEmitter — o processo
 * INTEIRO morre, levando todas as salas em memória junto. O banco só serve ao
 * login; uma queda dele não pode derrubar uma rodada em andamento.
 */
pool.on('error', (err) => {
  console.error('[postgres] cliente ocioso caiu (login indisponível):', err.message);
});

export const auth = betterAuth({
  database: pool,
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthUrl,

  // O proxy do Vite reescreve só o Host; o Origin continua sendo o do browser,
  // então as duas origens precisam ser confiáveis em dev.
  trustedOrigins: [...new Set([config.betterAuthUrl, ...config.corsOrigin])],

  socialProviders: {
    github: {
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
      // Obrigatório: sem user:email, quem tem e-mail primário privado no
      // GitHub volta do callback com email: null.
      scope: ['user:email'],
      mapProfileToUser: (profile) => ({
        login: profile.login,
      }),
    },
  },

  user: {
    additionalFields: {
      login: {
        type: 'string',
        required: false,
        // input: false é essencial — o handle é renderizado como sinal de
        // identidade, e sem isso qualquer um o forjaria via updateUser().
        input: false,
      },
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      // Curto de propósito: enquanto o cache vale, uma sessão revogada ainda
      // abre socket novo. 90s limita essa janela.
      maxAge: 90,
    },
  },

  // Só para o smoke test obter um cookie real. Ver o fail-fast em config.ts.
  emailAndPassword: {
    enabled: config.devPasswordAuth,
  },
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
