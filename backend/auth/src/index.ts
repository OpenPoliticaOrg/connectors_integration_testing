import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./routes/auth.js";
import { authMiddleware, optionalAuthMiddleware } from "./middleware/auth.js";
import type { AuthContext } from "./middleware/auth.js";

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "Auth API",
          version: "1.0.0",
          description:
            "Production-ready authentication API with Elysia, Better Auth, and JWT",
        },
      },
    }),
  )
  .use(
    cors({
      origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    }),
  )
  .use(authRoutes)

  // Public routes
  .get("/", () => ({
    message: "Welcome to the API",
    status: "ok",
    docs: "/swagger",
  }))

  .get("/health", () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }))

  // Protected routes with JWT
  .use(authMiddleware)
  .get("/api/me", ({ user, isAuthenticated }: AuthContext) => {
    if (!isAuthenticated) {
      return { error: "Unauthorized" };
    }
    return {
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        image: user?.image,
      },
    };
  })

  .get("/api/protected", ({ user, isAuthenticated, jwt }: AuthContext) => {
    if (!isAuthenticated) {
      return { error: "Unauthorized" };
    }
    return {
      message: "This is a protected route",
      user: user?.email,
      jwt: jwt,
    };
  })

  // Optional auth routes
  .use(optionalAuthMiddleware)
  .get("/api/public-or-auth", ({ user, isAuthenticated }: AuthContext) => {
    return {
      message: isAuthenticated
        ? `Hello ${user?.name || user?.email}!`
        : "Hello guest!",
      isAuthenticated,
    };
  })

  .listen(process.env.PORT || 5001);

console.log(
  `🚀 Server is running at ${app.server?.hostname}:${app.server?.port}`,
);
console.log(
  `📖 API Documentation: http://localhost:${app.server?.port}/swagger`,
);
console.log(`🔐 Auth endpoints available at /api/auth/*`);
console.log(`🔐 Protected endpoints at /api/me, /api/protected`);

export type App = typeof app;

// Export auth configuration and middleware for use by other services
export { auth } from "./lib/auth.js";
export { authMiddleware, optionalAuthMiddleware } from "./middleware/auth.js";
export type { AuthContext } from "./middleware/auth.js";
