import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// O .env vive na raiz do workspace. Resolver a partir deste arquivo faz
// funcionar tanto em src/ (tsx) quanto em dist/ (build) e independe do cwd —
// a CLI do Better Auth, por exemplo, roda de dentro de server/.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '..', '..', '.env'), quiet: true });
loadEnv({ quiet: true });

const num = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const required = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `[config] variável de ambiente obrigatória ausente: ${name}. ` +
        'Copie .env.example para .env e preencha.',
    );
  }
  return value;
};

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Sign-in por e-mail/senha existe só para o smoke test conseguir um cookie de
 * sessão real. Exige opt-in POSITIVO e falha no boot se coincidir com
 * produção: um portão baseado só em `NODE_ENV !== 'production'` falharia
 * ABERTO se a variável não estivesse setada, e como o account linking é padrão
 * e o e-mail do GitHub é verificado, um cadastro com o e-mail de um colega
 * seria vinculado à conta dele.
 */
const devPasswordAuth = process.env.ENABLE_DEV_PASSWORD_AUTH === 'true';
if (devPasswordAuth && isProduction) {
  throw new Error(
    '[config] ENABLE_DEV_PASSWORD_AUTH não pode estar ligado com NODE_ENV=production.',
  );
}

const betterAuthUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3001';

/**
 * `corsOrigin` também alimenta os `trustedOrigins` do Better Auth (que validam
 * para onde um `callbackURL` pode redirecionar). Cair no default de
 * desenvolvimento em produção deixaria `localhost` como origem confiável, então
 * lá o fallback é a própria URL do servidor — que é o caso de origem única.
 */
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ??
  (isProduction ? [betterAuthUrl] : ['http://localhost:5173']);

export const config = {
  port: num(process.env.PORT, 3001),
  corsOrigin,
  isProduction,

  /** Quanto um jogador offline sobrevive antes de ser removido da sala. */
  playerGraceMs: num(process.env.PLAYER_GRACE_MS, 45 * 1000),
  /** Frequência da varredura que aplica a graça e coleta salas vazias. */
  sweepIntervalMs: num(process.env.PLAYER_SWEEP_INTERVAL_MS, 10 * 1000),
  /** Tempo mínimo offline para o botão manual de limpar inativos alcançar alguém. */
  clearInactiveMinOfflineMs: num(process.env.CLEAR_INACTIVE_MIN_OFFLINE_MS, 10 * 1000),
  roomTtlMs: num(process.env.ROOM_TTL_MS, 2 * 60 * 60 * 1000),

  databaseUrl: required('DATABASE_URL', process.env.DATABASE_URL),
  betterAuthSecret: required('BETTER_AUTH_SECRET', process.env.BETTER_AUTH_SECRET),
  /**
   * URL do SERVIDOR, não a origem do browser. Em dev continua sendo a :3001
   * mesmo com o Vite na :5173 — cookies ignoram porta, então o cookie emitido
   * por localhost:3001 é enviado também para localhost:5173.
   */
  betterAuthUrl,
  githubClientId: required('GITHUB_CLIENT_ID', process.env.GITHUB_CLIENT_ID),
  githubClientSecret: required('GITHUB_CLIENT_SECRET', process.env.GITHUB_CLIENT_SECRET),
  devPasswordAuth,
};
