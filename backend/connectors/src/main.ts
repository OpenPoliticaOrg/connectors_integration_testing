import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { oauthRoutes } from "@/routes/oauth";
import { agentRoutes } from "@/routes/agent";
import { slackEventsRoutes } from "@/routes/slack-events";
import { linearEventsRoutes } from "@/routes/linear-events";
import { standardRateLimit } from "@/middleware/rate-limit";

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
  
  // Webhooks: NO rate limiting - secured by signature verification
  // Slack, GitHub, and Linear sign their webhooks - we verify signatures
  // Their platforms have their own rate limits, we don't need to add ours
  .use(oauthRoutes)
  .use(slackEventsRoutes)
  .use(linearEventsRoutes)
  
  // API routes: Rate limited (user-facing endpoints)
  .use(standardRateLimit)
  .use(agentRoutes)
  
  .listen(process.env.PORT || 5002);

console.log(`🚀 Connectors service running at ${app.server?.hostname}:${app.server?.port}`);
console.log(
  `🔐 JWT validation via JWKS: ${process.env.AUTH_JWKS_URL || "http://localhost:3000/.well-known/jwks.json"}`,
);
console.log(`📡 Webhooks: No rate limit (signature verified)`);
console.log(`🔒 API routes: JWT required, rate limited (100 req/min)`);
