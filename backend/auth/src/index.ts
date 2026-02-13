import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { auth } from "@/lib/auth";

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "Auth API",
          version: "1.0.0",
          description: "Production-ready authentication API with Better Auth and JWT",
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
  .mount(auth.handler)
  .get("/health", () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }))
  .get("/", () => ({
    message: "Welcome to the Auth API",
    status: "ok",
    endpoints: {
      auth: "/api/auth/*",
      jwks: "/api/auth/jwks",
      health: "/health",
    },
  }))
  .listen(process.env.PORT || 5001);

console.log(`🚀 Server is running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`📖 API Documentation: http://localhost:${app.server?.port}/swagger`);
console.log(`🔐 Auth endpoints available at /api/auth/*`);
console.log(`🔐 JWKS endpoint at /api/auth/jwks`);

export { auth };
export type { Session, User } from "@/lib/auth";