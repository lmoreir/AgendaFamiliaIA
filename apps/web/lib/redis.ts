import Redis from "ioredis";

/**
 * Cliente Redis singleton.
 * Em produção usa Upstash (serverless Redis).
 * Em desenvolvimento usa Redis local via Docker.
 *
 * Uso: import { redis } from "../lib/redis"
 */

declare global {
  var __redis: Redis | undefined;
}

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || "redis://localhost:6379";

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("[Redis] Erro de conexão:", err);
  });

  return client;
}

// Singleton: reutiliza conexão em hot-reload do Next.js dev
export const redis =
  globalThis.__redis ?? (globalThis.__redis = createRedisClient());

/**
 * Helpers para operações comuns do projeto
 */
export const RedisKeys = {
  conversationContext: (userId: string) => `conversation:${userId}:context`,
  reminderLock: (reminderId: string) => `reminder:${reminderId}:lock`,
  rateLimitWhatsApp: (phone: string) => `ratelimit:whatsapp:${phone}`,
} as const;

export const REDIS_TTL = {
  conversationContext: 60 * 60 * 24,    // 24 horas
  reminderLock: 60 * 5,                  // 5 minutos
  rateLimitWhatsApp: 60,                 // 1 minuto
} as const;
