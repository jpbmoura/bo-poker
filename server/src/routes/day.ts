import type { Response } from 'express';
import { dayKey, isDayKey } from '../capture/dailySpawn.js';
import type { AuthedRequest } from './session.js';

/**
 * O body leva o `day` que o cliente está mostrando: se o dia virou com o
 * drawer ou o modal aberto, a ação NÃO pode cair no Pokémon de amanhã sem a
 * pessoa ver. Null = já respondeu o erro.
 */
export function requestDay(req: AuthedRequest, res: Response, now: Date): string | null {
  const day = dayKey(now);
  if (!isDayKey(req.body?.day)) {
    res.status(400).json({ error: 'INVALID_DAY' });
    return null;
  }
  if (req.body.day !== day) {
    res.status(409).json({ error: 'DAY_CHANGED' });
    return null;
  }
  return day;
}
