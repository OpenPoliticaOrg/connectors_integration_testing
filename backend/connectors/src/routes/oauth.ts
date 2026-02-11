import { Elysia, t } from "elysia";
import { db, schema } from "@backend/db";
import { eq } from "drizzle-orm";
import { jwtAuthMiddleware } from "@/middleware/jwt-auth";
import { encrypt, decryptSafe } from "@/lib/encryption";
import { generatePKCE, pkceStore } from "@/lib/pkce";

const { githubInstallations, slackConnections, linearConnections } = schema;

export const oauthRoutes = new Elysia({ prefix: "/oauth" })
  // ==========================================
  // LINEAR OAUTH FLOW
  // ==========================================

  // Get Linear OAuth URL
  .get("/linear", async ({ query }) => {
    const clientId = process.env.LINEAR_CLIENT_ID;
    const redirectUri = process.env.LINEAR_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return {
        success: false,
        error: "Linear OAuth not configured",
      };
    }

    const state = crypto.randomUUID();
    const scope = "read write issues:create issues:update";

    // Generate PKCE pair for OAuth 2.1 security
    const pkce = generatePKCE();
    
    // Store code verifier temporarily (10 minute expiration)
    pkceStore.set(state, pkce.codeVerifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod,
    });

    return {
      success: true,
      data: {
        url: `https://linear.app/oauth/authorize?${params.toString()}`,
        state,
        message: "Authorize Linear to connect your workspace",
      },
    };
  })

  // Linear OAuth callback
  .get("/linear/callback", async ({ query }) => {
    const { code, state } = query as { code?: string; state?: string };

    if (!code) {
      return {
        success: false,
        error: "Authorization code missing",
      };
    }

    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;
    const redirectUri = process.env.LINEAR_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return {
        success: false,
        error: "Linear OAuth not configured",
      };
    }

    try {
      // Retrieve and verify PKCE code verifier
      const codeVerifier = pkceStore.get(state || "");
      
      if (!codeVerifier) {
        return {
          success: false,
          error: "Invalid or expired state parameter. Please restart OAuth flow.",
        };
      }

      // Exchange code for access token (with PKCE)
      const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier, // PKCE verification
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        return {
          success: false,
          error: `Token exchange failed: ${error}`,
        };
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token, expires_in, scope } = tokenData;

      // Encrypt tokens before storing
      const encryptedAccessToken = encrypt(access_token);
      const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

      // Fetch user info from Linear
      const userResponse = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          Authorization: access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query {
              viewer {
                id
                name
                email
                organization {
                  id
                  name
                }
              }
            }
          `,
        }),
      });

      if (!userResponse.ok) {
        return {
          success: false,
          error: "Failed to fetch user info",
        };
      }

      const userData = await userResponse.json();
      const viewer = userData.data?.viewer;

      if (!viewer) {
        return {
          success: false,
          error: "Failed to get user info from Linear",
        };
      }

      // Store the connection temporarily (will be linked to user on frontend)
      // Tokens are encrypted with AES-256-GCM
      const [connection] = await db
        .insert(linearConnections)
        .values({
          userId: "temp_pending_link", // Will be updated when user links
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: expires_in
            ? new Date(Date.now() + expires_in * 1000)
            : null,
          linearUserId: viewer.id,
          linearUserName: viewer.name,
          linearOrganizationId: viewer.organization?.id,
          linearOrganizationName: viewer.organization?.name,
          scopes: scope?.split(" ") || ["read", "write"],
          isActive: true,
        })
        .returning();

      if (!connection) {
        return {
          success: false,
          error: "Failed to create connection",
        };
      }

      return {
        success: true,
        data: {
          message: "Linear authorization successful",
          connectionId: connection.id,
          linearUser: {
            id: viewer.id,
            name: viewer.name,
            email: viewer.email,
          },
          organization: viewer.organization,
        },
      };
    } catch (error) {
      console.error("Linear OAuth error:", error);
      return {
        success: false,
        error: `OAuth failed: ${(error as Error).message}`,
      };
    }
  })

  // Link Linear connection to authenticated user
  .use(jwtAuthMiddleware)
  .post(
    "/linear/link",
    async ({ body, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const { connectionId } = body as { connectionId: string };

      const connection = await db.query.linearConnections.findFirst({
        where: eq(linearConnections.id, connectionId),
      });

      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      if (connection.userId !== "temp_pending_link") {
        return { success: false, error: "Connection already linked" };
      }

      await db
        .update(linearConnections)
        .set({ userId: user.id })
        .where(eq(linearConnections.id, connectionId));

      return {
        success: true,
        data: {
          message: "Linear connected successfully",
          linearUser: connection?.linearUserName,
          organization: connection?.linearOrganizationName,
        },
      };
    },
    {
      body: t.Object({
        connectionId: t.String(),
      }),
    },
  )

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

    const linear = await db.query.linearConnections.findFirst({
      where: eq(linearConnections.userId, user.id),
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
          linear: linear
            ? {
                connected: true,
                userName: linear.linearUserName,
                organizationName: linear.linearOrganizationName,
                scopes: linear.scopes,
                isActive: linear.isActive,
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
      } else if (provider === "linear") {
        await db
          .update(linearConnections)
          .set({ isActive: false })
          .where(eq(linearConnections.userId, user.id));
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
