import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { auth } from "@/lib/auth";

const jwtPlugin = jwt({
  name: "jwt",
  secret: process.env.JWT_SECRET || "your-jwt-secret-key",
  exp: "7d",
});

export const authMiddleware = new Elysia()
  .use(jwtPlugin)
  .derive({ as: "scoped" }, async ({ request, jwt, set }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      set.status = 401;
      return {
        user: null,
        session: null,
        isAuthenticated: false,
        jwt: null,
      };
    }

    const jwtToken = await jwt.sign({
      userId: session.user.id,
      email: session.user.email,
    });

    return {
      user: session.user,
      session: session.session,
      jwt: jwtToken,
      isAuthenticated: true,
    };
  });

export const optionalAuthMiddleware = new Elysia()
  .use(jwtPlugin)
  .derive({ as: "scoped" }, async ({ request, jwt }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return {
        user: null,
        session: null,
        isAuthenticated: false,
        jwt: null,
      };
    }

    const jwtToken = await jwt.sign({
      userId: session.user.id,
      email: session.user.email,
    });

    return {
      user: session.user,
      session: session.session,
      jwt: jwtToken,
      isAuthenticated: true,
    };
  });

export type AuthContext = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  } | null;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  } | null;
  jwt: string | null;
  isAuthenticated: boolean;
};
