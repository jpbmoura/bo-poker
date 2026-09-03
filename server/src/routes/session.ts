import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

export interface AuthedRequest extends Request {
  userId?: string;
  userName?: string;
}

/**
 * Distingue "não achei" de "o banco piscou". Sem isso, uma oscilação do
 * Postgres apareceria para o usuário como "isso não existe" — e no caso da
 * progressão, como se ele tivesse perdido o Pokémon.
 */
export function dbError(res: Response, err: unknown, tag: string, context: string): void {
  console.error(`[${tag}] ${context}:`, (err as Error).message);
  res.status(503).json({ error: 'DB_UNAVAILABLE' });
}

/** Resolve a sessão do Better Auth pelo cookie e põe o usuário no request. */
export function requireUser(tag: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        res.status(401).json({ error: 'UNAUTHENTICATED' });
        return;
      }
      req.userId = session.user.id;
      req.userName = session.user.name;
      next();
    } catch (err) {
      dbError(res, err, tag, 'falha ao resolver sessão');
    }
  };
}
