import { Elysia, t } from "elysia";
import { db, schema } from "@backend/db";
import { eq, and } from "drizzle-orm";
import { jwtAuthMiddleware } from "../middleware/jwt-auth.js";
import { mcpClientManager } from "../mcp/client.js";

const { agentRuns, tools, userTools, githubInstallations } = schema;

export const agentRoutes = new Elysia({ prefix: "/agent" })
  .use(jwtAuthMiddleware)

  // Run agent - REQUIRES JWT AUTH
  .post(
    "/run",
    async ({ body, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const { prompt } = body;
      const userId = user.id;

      const [run] = await db
        .insert(agentRuns)
        .values({
          userId,
          prompt,
          status: "running",
          startedAt: new Date(),
        })
        .returning();

      if (!run) {
        return { success: false, error: "Failed to create agent run" };
      }

      try {
        const githubInstallation = await db.query.githubInstallations.findFirst(
          {
            where: and(
              eq(githubInstallations.userId, userId),
              eq(githubInstallations.isActive, true),
            ),
          },
        );

        if (githubInstallation) {
          await mcpClientManager.connectServer({
            id: "github",
            name: "github",
            url: process.env.GITHUB_MCP_URL!,
          });
        }

        const availableTools = mcpClientManager.getAllTools();

        const enabledTools = await db.query.userTools.findMany({
          where: and(
            eq(userTools.userId, userId),
            eq(userTools.isEnabled, true),
          ),
        });

        const enabledNames = new Set(enabledTools.map((t) => t.toolName));
        const filteredTools = availableTools.filter((tool) =>
          enabledNames.has(tool.name),
        );

        const response = await executeWithMastra({
          prompt,
          tools: filteredTools,
          context: {
            userId,
            githubInstallationId:
              githubInstallation?.installationId ?? undefined,
            githubAccount: githubInstallation?.accountLogin ?? undefined,
          },
        });

        await db
          .update(agentRuns)
          .set({
            status: "completed",
            response,
            completedAt: new Date(),
          })
          .where(eq(agentRuns.id, run.id));

        return {
          success: true,
          data: {
            runId: run.id,
            response,
            toolsUsed: filteredTools.map((t) => t.name),
          },
        };
      } catch (error) {
        await db
          .update(agentRuns)
          .set({
            status: "failed",
            errorMessage: (error as Error).message,
            completedAt: new Date(),
          })
          .where(eq(agentRuns.id, run.id));

        return {
          success: false,
          error: (error as Error).message,
        };
      } finally {
        await mcpClientManager.disconnectAll();
      }
    },
    {
      body: t.Object({
        prompt: t.String({ minLength: 1 }),
        threadId: t.Optional(t.String()),
      }),
    },
  )

  // Get agent runs - REQUIRES JWT AUTH
  .get("/runs", async ({ user, isAuthenticated }) => {
    if (!isAuthenticated || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const runs = await db.query.agentRuns.findMany({
      where: eq(agentRuns.userId, user.id),
      orderBy: (runs, { desc }) => [desc(runs.createdAt)],
      limit: 50,
    });

    return {
      success: true,
      data: { runs },
    };
  })

  // Get available tools - REQUIRES JWT AUTH
  .get("/tools", async ({ user, isAuthenticated }) => {
    if (!isAuthenticated || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const allTools = await db.query.tools.findMany({
      where: eq(tools.isActive, true),
    });

    return {
      success: true,
      data: {
        tools: allTools.map((t) => ({
          name: t.name,
          displayName: t.displayName,
          description: t.description,
          provider: t.provider,
          category: t.category,
        })),
      },
    };
  });

async function executeWithMastra({
  prompt,
  tools,
  context,
}: {
  prompt: string;
  tools: any[];
  context: {
    userId: string;
    githubInstallationId?: number;
    githubAccount?: string;
  };
}): Promise<string> {
  if (tools.length === 0) {
    return `I received: "${prompt}"\n\nNo tools enabled. Connect GitHub or Slack first.`;
  }

  const toolList = tools.map((t) => t.name).join(", ");

  return `I received: "${prompt}"\n\nAvailable tools: ${toolList}\n\nContext: user=${context.userId}, github=${context.githubAccount || "not connected"}\n\n[Note: Mastra integration not yet implemented]`;
}
