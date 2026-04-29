export const config = {
  port: Number(process.env.PORT) || 3001,
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  cleanupIntervalMs: 30 * 60 * 1000,
  roomTtlMs: 2 * 60 * 60 * 1000,
};
