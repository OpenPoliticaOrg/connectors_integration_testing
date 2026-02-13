/**
 * Rate limiting middleware for connectors service
 * 
 * Uses Redis for distributed rate limiting across multiple server instances
 * Bun provides native Redis bindings - no external dependencies needed
 * 
 * NOTE: Webhooks are NOT rate limited here because:
 * 1. They are secured by signature verification (Slack, GitHub, Linear all sign webhooks)
 * 2. These platforms have their own rate limits
 * 3. Active conversations can generate many events - we don't want to lose them
 */

import { Elysia } from "elysia";
import { RedisClient } from "bun";

let redis: RedisClient | null = null;

function getRedis(): RedisClient {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new RedisClient(redisUrl, {
      connectionTimeout: 5000,
      autoReconnect: true,
      maxRetries: 10,
      enableOfflineQueue: true,
    });
    
    redis.onconnect = () => {
      console.log("✅ Redis connected for rate limiting");
    };
    
    redis.onclose = (error) => {
      console.error("❌ Redis connection closed:", error);
    };
  }
  return redis;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: Request) => string;
  skip?: (request: Request) => boolean;
  prefix?: string;
}

function defaultKeyGenerator(request: Request): string {
  const ip = request.headers.get("x-forwarded-for") ||
             request.headers.get("x-real-ip") ||
             "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  const clientIp = ip.split(",")[0]?.trim() ?? "unknown";
  
  return `${clientIp}:${userAgent.slice(0, 50)}`;
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skip,
    prefix = "ratelimit",
  } = config;

  return new Elysia().derive({ as: "scoped" }, async ({ request, set }) => {
    if (skip?.(request)) {
      return { rateLimitPassed: true };
    }

    const key = keyGenerator(request);
    const redisKey = `${prefix}:${key}`;
    const windowSecs = Math.ceil(windowMs / 1000);

    try {
      const client = getRedis();
      
      const count = await client.incr(redisKey);
      
      if (count === 1) {
        await client.expire(redisKey, windowSecs);
      }
      
      const ttl = await client.ttl(redisKey);
      
      if (count > maxRequests) {
        set.status = 429;
        set.headers = {
          "Retry-After": String(ttl),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + ttl),
        } as Record<string, string>;
        
        return {
          rateLimitPassed: false,
          rateLimitError: "Too many requests, please try again later",
        };
      }
      
      return { 
        rateLimitPassed: true,
        rateLimitRemaining: maxRequests - count,
        rateLimitReset: ttl,
      };
    } catch (error) {
      console.error("Redis rate limit error:", error);
      
      return { rateLimitPassed: true };
    }
  });
}

export const strictRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  prefix: "strict",
});

export const standardRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  prefix: "api",
});

export function checkRateLimit(
  rateLimitPassed: boolean,
  rateLimitError?: string,
  set?: { status: number }
) {
  if (!rateLimitPassed) {
    if (set) {
      set.status = 429;
    }
    return {
      success: false,
      error: rateLimitError || "Rate limit exceeded",
    };
  }
  return null;
}

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    redis.close();
    redis = null;
    console.log("🔌 Redis connection closed");
  }
}
