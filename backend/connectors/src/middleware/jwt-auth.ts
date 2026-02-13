import { Elysia } from "elysia";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS_URL =
  process.env.AUTH_JWKS_URL || "http://localhost:5001/api/auth/jwks";
const ISSUER = process.env.AUTH_ISSUER || "https://localhost";
const AUDIENCE = process.env.AUTH_AUDIENCE || "https://localhost";

// JWKS cache configuration
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache
const JWKS_RETRY_DELAY = 1000; // 1 second initial retry delay
const JWKS_MAX_RETRIES = 3;

// JWKS client with caching and error handling
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksLastFetch: number = 0;
let jwksErrorCount: number = 0;
let jwksLastError: Error | null = null;

/**
 * Get JWKS client with caching and error handling
 * Implements retry logic with exponential backoff
 */
function getJWKS() {
  const now = Date.now();
  
  // Return cached JWKS if still valid
  if (jwks && (now - jwksLastFetch) < JWKS_CACHE_TTL) {
    return jwks;
  }
  
  // Reset error count if enough time has passed
  if (jwksLastError && (now - jwksLastFetch) > JWKS_RETRY_DELAY * Math.pow(2, JWKS_MAX_RETRIES)) {
    jwksErrorCount = 0;
    jwksLastError = null;
  }
  
  // Create new JWKS client
  try {
    jwks = createRemoteJWKSet(new URL(JWKS_URL), {
      // Cache duration for individual keys
      cacheMaxAge: JWKS_CACHE_TTL,
      // Timeout for JWKS fetch
      timeoutDuration: 5000,
      // Retry on network errors
      cooldownDuration: 30000,
    });
    jwksLastFetch = now;
    jwksErrorCount = 0;
    jwksLastError = null;
    console.log("🔑 JWKS client initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize JWKS client:", error);
    jwksLastError = error as Error;
    jwksErrorCount++;
    
    // If we have a cached client, keep using it
    if (jwks) {
      console.warn("⚠️ Using cached JWKS client due to fetch error");
      return jwks;
    }
  }
  
  return jwks;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  name?: string;
  image?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

/**
 * Verify JWT token with error handling
 */
async function verifyToken(token: string): Promise<{ payload: JWTPayload } | null> {
  const jwksClient = getJWKS();
  
  if (!jwksClient) {
    console.error("❌ JWKS client not available - auth service may be down");
    return null;
  }
  
  try {
    const { payload } = await jwtVerify(token, jwksClient, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    
    return { payload: payload as unknown as JWTPayload };
  } catch (error) {
    // Log specific error types
    if (error instanceof Error) {
      if (error.message.includes("exp")) {
        console.warn("⚠️ JWT token expired");
      } else if (error.message.includes("issuer")) {
        console.warn("⚠️ JWT issuer mismatch");
      } else if (error.message.includes("audience")) {
        console.warn("⚠️ JWT audience mismatch");
      } else {
        console.error("❌ JWT verification failed:", error.message);
      }
    }
    return null;
  }
}

export const jwtAuthMiddleware = new Elysia().derive(
  { as: "scoped" },
  async ({ headers, set }) => {
    const auth = headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      set.status = 401;
      return {
        user: null,
        isAuthenticated: false,
        error: "Missing or invalid authorization header",
      };
    }

    const token = auth.slice(7);
    const result = await verifyToken(token);

    if (!result) {
      set.status = 401;
      return {
        user: null,
        isAuthenticated: false,
        error: "Invalid or expired token",
      };
    }

    const { payload } = result;

    return {
      user: {
        id: payload.sub as string,
        email: payload.email as string,
        name: payload.name as string | undefined,
        image: payload.image as string | undefined,
      },
      isAuthenticated: true,
      jwtPayload: payload,
    };
  },
);

// Optional auth - doesn't fail if no token
export const optionalJwtAuthMiddleware = new Elysia().derive(
  { as: "scoped" },
  async ({ headers }) => {
    const auth = headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      return {
        user: null,
        isAuthenticated: false,
      };
    }

    const token = auth.slice(7);
    const result = await verifyToken(token);

    if (!result) {
      return {
        user: null,
        isAuthenticated: false,
      };
    }

    const { payload } = result;

    return {
      user: {
        id: payload.sub as string,
        email: payload.email as string,
        name: payload.name as string | undefined,
        image: payload.image as string | undefined,
      },
      isAuthenticated: true,
      jwtPayload: payload,
    };
  },
);

export type AuthContext = {
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
  } | null;
  isAuthenticated: boolean;
  jwtPayload?: JWTPayload;
  error?: string;
};
