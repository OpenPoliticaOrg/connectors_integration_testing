import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { oauthRoutes } from "@/routes/oauth";
import { agentRoutes } from "@/routes/agent";
import { slackEventsRoutes } from "@/routes/slack-events";
import { linearEventsRoutes } from "@/routes/linear-events";

const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
      credentials: true,
    }),
  )
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .use(oauthRoutes)
  .use(slackEventsRoutes)
  .use(linearEventsRoutes)
  .use(agentRoutes)
  .listen(process.env.PORT || 5002);

console.log(`🚀 Connectors service running at ${app.server?.hostname}:${app.server?.port}`);
console.log(
  `🔐 JWT validation via JWKS: ${process.env.AUTH_JWKS_URL || "http://localhost:3000/.well-known/jwks.json"}`,
);
console.log(`📡 Webhooks: No auth (signature verified)`);
console.log(`🔒 API routes: JWT required`);

export type App = typeof app;
