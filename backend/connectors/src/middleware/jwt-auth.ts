import { Elysia } from "elysia";
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS_URL =
  process.env.AUTH_JWKS_URL || "http://localhost:3000/.well-known/jwks.json";
const ISSUER = process.env.AUTH_ISSUER || "http://localhost:3000";
const AUDIENCE = process.env.AUTH_AUDIENCE || "http://localhost:3000";

// Create JWKS client - caches keys indefinitely
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URL));
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

    try {
      const { payload } = await jwtVerify(token, getJWKS(), {
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      return {
        user: {
          id: payload.sub as string,
          email: payload.email as string,
          name: payload.name as string | undefined,
          image: payload.image as string | undefined,
        },
        isAuthenticated: true,
        jwtPayload: payload as unknown as JWTPayload,
      };
    } catch (error) {
      console.error("JWT verification failed:", error);
      set.status = 401;
      return {
        user: null,
        isAuthenticated: false,
        error: "Invalid or expired token",
      };
    }
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

    try {
      const { payload } = await jwtVerify(token, getJWKS(), {
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      return {
        user: {
          id: payload.sub as string,
          email: payload.email as string,
          name: payload.name as string | undefined,
          image: payload.image as string | undefined,
        },
        isAuthenticated: true,
        jwtPayload: payload as unknown as JWTPayload,
      };
    } catch (error) {
      console.error("JWT verification failed:", error);
      return {
        user: null,
        isAuthenticated: false,
      };
    }
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
