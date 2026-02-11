import { Elysia, t } from "elysia";
import { db, schema } from "@backend/db";
import { eq } from "drizzle-orm";
import { jwtAuthMiddleware } from "../middleware/jwt-auth.js";

const { githubInstallations, slackConnections } = schema;

export const oauthRoutes = new Elysia({ prefix: "/oauth" })
  // ==========================================
  // GITHUB APP - Installation Flow
  // ==========================================

  // Get GitHub App installation URL
  .get("/github", async () => {
    const appName = process.env.GITHUB_APP_NAME;

    if (!appName) {
      return {
        success: false,
        error: "GitHub App not configured",
      };
    }

    return {
      success: true,
      data: {
        url: `https://github.com/apps/${appName}/installations/new`,
        message: "Install the GitHub App to connect your repositories",
      },
    };
  })

  // GitHub App webhook - NO AUTH (called by GitHub)
  .post(
    "/github/webhook",
    async ({ body }) => {
      const { action, installation } = body as any;

      if (action === "created" || action === "added") {
        await db.insert(githubInstallations).values({
          userId: "system",
          installationId: installation.id,
          accountLogin: installation.account?.login,
          accountType: installation.account?.type,
          repositories: (installation.repositories || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            fullName: r.full_name,
            private: r.private,
          })),
          isActive: true,
        });

        return { success: true, message: "GitHub App installed" };
      }

      if (action === "deleted" || action === "removed") {
        await db
          .update(githubInstallations)
          .set({ isActive: false })
          .where(eq(githubInstallations.installationId, installation.id));

        return { success: true, message: "GitHub App uninstalled" };
      }

      return { success: true, message: "Webhook processed" };
    },
    {
      body: t.Object({
        action: t.String(),
        installation: t.Object({
          id: t.Number(),
          account: t.Optional(
            t.Object({
              login: t.String(),
              type: t.String(),
            }),
          ),
          repositories: t.Optional(t.Array(t.Any())),
        }),
      }),
    },
  )

  // Link installation - REQUIRES JWT AUTH
  .use(jwtAuthMiddleware)
  .post(
    "/github/link",
    async ({ body, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const { installationId } = body;

      const installation = await db.query.githubInstallations.findFirst({
        where: eq(githubInstallations.installationId, installationId),
      });

      if (!installation) {
        return { success: false, error: "Installation not found" };
      }

      await db
        .update(githubInstallations)
        .set({ userId: user.id })
        .where(eq(githubInstallations.installationId, installationId));

      return {
        success: true,
        data: {
          message: "GitHub connected successfully",
          installationId,
          repositories: installation.repositories,
        },
      };
    },
    {
      body: t.Object({
        installationId: t.Number(),
      }),
    },
  )

  // Get connections - REQUIRES JWT AUTH
  .get("/connections", async ({ user, isAuthenticated }) => {
    if (!isAuthenticated || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const github = await db.query.githubInstallations.findFirst({
      where: eq(githubInstallations.userId, user.id),
    });

    const slack = await db.query.slackConnections.findFirst({
      where: eq(slackConnections.userId, user.id),
    });

    return {
      success: true,
      data: {
        connections: {
          github: github
            ? {
                connected: true,
                installationId: github.installationId,
                account: github.accountLogin,
                repositories: github.repositories,
                isActive: github.isActive,
              }
            : null,
          slack: slack
            ? {
                connected: true,
                teamName: slack.teamName,
                scopes: slack.scopes,
                isActive: slack.isActive,
              }
            : null,
        },
      },
    };
  })

  // Disconnect - REQUIRES JWT AUTH
  .delete(
    "/connections/:provider",
    async ({ params, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const { provider } = params;

      if (provider === "github") {
        await db
          .update(githubInstallations)
          .set({ isActive: false })
          .where(eq(githubInstallations.userId, user.id));
      } else if (provider === "slack") {
        await db
          .update(slackConnections)
          .set({ isActive: false })
          .where(eq(slackConnections.userId, user.id));
      }

      return {
        success: true,
        data: { message: `${provider} disconnected` },
      };
    },
    {
      params: t.Object({
        provider: t.String(),
      }),
    },
  );
