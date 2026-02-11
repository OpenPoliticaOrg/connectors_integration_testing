import { Elysia, t } from "elysia";
import { db, schema } from "@backend/db";
import { eq, and, desc } from "drizzle-orm";
import { jwtAuthMiddleware } from "@/middleware/jwt-auth";

const { linearEvents, linearConnections } = schema;

const LINEAR_WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET || "";

/**
 * Verify Linear webhook signature
 * Linear sends a secret in the Authorization header (Bearer token)
 */
function verifyLinearWebhook(authHeader: string | null): boolean {
  if (!LINEAR_WEBHOOK_SECRET) {
    console.warn("LINEAR_WEBHOOK_SECRET not set, skipping verification");
    return true;
  }

  if (!authHeader) {
    return false;
  }

  // Linear sends: Authorization: Bearer <webhook-secret>
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return false;
  }

  return parts[1] === LINEAR_WEBHOOK_SECRET;
}

/**
 * Determine if AI should react to this event
 */
function shouldAiReactToEvent(eventData: any): {
  shouldReact: boolean;
  reason: string;
  suggestedAction?: string;
} {
  const { type, data } = eventData;

  // Issue-related events
  if (type === "Issue") {
    const action = data?.updatedFrom ? "updated" : "created";
    const state = data?.state?.name || "";
    const priority = data?.priority || 0;

    // High priority issues
    if (priority >= 3) {
      return {
        shouldReact: true,
        reason: "High priority issue",
        suggestedAction: "notify_team",
      };
    }

    // Issues moved to specific states
    if (state.toLowerCase().includes("urgent") || state.toLowerCase().includes("critical")) {
      return {
        shouldReact: true,
        reason: "Issue moved to critical state",
        suggestedAction: "escalate",
      };
    }

    // Issues assigned to specific users
    if (data?.assignee?.id) {
      return {
        shouldReact: false,
        reason: "Issue assigned normally",
      };
    }
  }

  // Comment events - check if mentions or important
  if (type === "Comment") {
    const body = data?.body || "";
    
    // Comments with mentions
    if (body.includes("@") || body.includes("<a ")) {
      return {
        shouldReact: true,
        reason: "Comment with mentions",
        suggestedAction: "notify_mentioned",
      };
    }

    // Comments on high priority issues
    if (data?.issue?.priority >= 3) {
      return {
        shouldReact: true,
        reason: "Comment on high priority issue",
        suggestedAction: "summarize",
      };
    }
  }

  // Cycle events
  if (type === "Cycle") {
    const action = data?.updatedFrom ? "updated" : "created";
    
    if (action === "created" && data?.startsAt) {
      const startDate = new Date(data.startsAt);
      const today = new Date();
      const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        return {
          shouldReact: true,
          reason: "Cycle starting soon",
          suggestedAction: "prepare_cycle_summary",
        };
      }
    }
  }

  // Project events
  if (type === "Project") {
    const state = data?.state || "";
    
    if (state === "completed" || state === "canceled") {
      return {
        shouldReact: true,
        reason: "Project completed or canceled",
        suggestedAction: "project_retrospective",
      };
    }
  }

  return {
    shouldReact: false,
    reason: "Event does not meet AI reaction criteria",
  };
}

/**
 * Extract organization ID from webhook data
 * Linear webhooks include organization info in the context
 */
function extractOrganizationId(eventData: any): string | null {
  // Try different paths where organization ID might be
  return (
    eventData?.organizationId ||
    eventData?.data?.team?.organization?.id ||
    eventData?.data?.organization?.id ||
    null
  );
}

/**
 * Extract relevant IDs from event data
 */
function extractEventDetails(eventData: any) {
  const data = eventData?.data || {};
  
  return {
    actorId: data?.actor?.id || null,
    actorName: data?.actor?.name || null,
    issueId: data?.id || null,
    issueIdentifier: data?.identifier || null,
    issueTitle: data?.title || null,
    projectId: data?.project?.id || null,
    projectName: data?.project?.name || null,
    teamId: data?.team?.id || null,
    teamName: data?.team?.name || null,
  };
}

export const linearEventsRoutes = new Elysia({ prefix: "/linear" })
  // ==========================================
  // LINEAR WEBHOOKS - NO AUTH (signature verified)
  // ==========================================

  .post(
    "/webhook",
    async ({ request, body }) => {
      const authHeader = request.headers.get("authorization");
      
      // Verify webhook signature
      if (!verifyLinearWebhook(authHeader)) {
        console.error("❌ Invalid Linear webhook signature");
        return { success: false, error: "Invalid signature" };
      }

      const eventData = body as any;
      const eventType = eventData?.type || "Unknown";
      const webhookId = eventData?.webhookId || crypto.randomUUID();
      const timestamp = eventData?.createdAt 
        ? new Date(eventData.createdAt) 
        : new Date();

      console.log(`📨 Received Linear webhook: ${eventType} (${webhookId})`);

      // Extract organization ID
      const organizationId = extractOrganizationId(eventData);
      
      if (!organizationId) {
        console.error("❌ Could not extract organization ID from webhook");
        return { success: false, error: "Invalid organization" };
      }

      // Find the user connection for this organization
      const connection = await db.query.linearConnections.findFirst({
        where: eq(linearConnections.linearOrganizationId, organizationId),
      });

      if (!connection) {
        console.warn(`⚠️ No Linear connection found for organization: ${organizationId}`);
        // Still store the event but mark with no user
      }

      // Check for duplicate
      const existing = await db.query.linearEvents.findFirst({
        where: eq(linearEvents.webhookId, webhookId),
      });

      if (existing) {
        console.log(`⏭️ Duplicate webhook ${webhookId}, skipping`);
        return { success: true, message: "Duplicate event" };
      }

      // Determine if AI should react
      const aiDecision = shouldAiReactToEvent(eventData);

      // Extract event details
      const details = extractEventDetails(eventData);

      // Store the event
      const inserted = await db.insert(linearEvents).values({
        organizationId,
        userId: connection?.userId || null,
        eventType,
        webhookId,
        eventTimestamp: timestamp,
        actorId: details.actorId,
        actorName: details.actorName,
        issueId: details.issueId,
        issueIdentifier: details.issueIdentifier,
        issueTitle: details.issueTitle,
        projectId: details.projectId,
        projectName: details.projectName,
        teamId: details.teamId,
        teamName: details.teamName,
        eventData,
        processed: false,
        shouldAiReact: aiDecision.shouldReact,
        aiReactionTriggered: false,
      }).returning();

      const event = inserted[0];

      if (!event) {
        console.error("❌ Failed to insert Linear event");
        return { success: false, error: "Failed to store event" };
      }

      console.log(`✅ Stored Linear event: ${eventType} (${webhookId})`);
      console.log(`🤖 AI should react: ${aiDecision.shouldReact} (${aiDecision.reason})`);

      // If AI should react, trigger async processing
      if (aiDecision.shouldReact && connection?.userId) {
        // Trigger async processing (non-blocking)
        processLinearEvent(event.id, aiDecision).catch(err => {
          console.error(`❌ Error processing Linear event ${event.id}:`, err);
        });
      }

      return { success: true };
    },
    {
      body: t.Object({
        webhookId: t.Optional(t.String()),
        webhookTimestamp: t.Optional(t.Number()),
        webhookSignature: t.Optional(t.String()),
        type: t.String(),
        data: t.Any(),
        createdAt: t.Optional(t.String()),
        organizationId: t.Optional(t.String()),
      }),
    },
  )

  // ==========================================
  // API ROUTES - REQUIRES JWT AUTH
  // ==========================================

  .use(jwtAuthMiddleware)

  // Get Linear events
  .get(
    "/events",
    async ({ query, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const limit = parseInt(query.limit || "50");
      const eventType = query.type;
      const processed = query.processed;
      const shouldReact = query.shouldReact;

      let conditions: any = eq(linearEvents.userId, user.id);

      if (eventType) {
        conditions = and(conditions, eq(linearEvents.eventType, eventType));
      }

      if (processed !== undefined) {
        conditions = and(conditions, eq(linearEvents.processed, processed === "true"));
      }

      if (shouldReact !== undefined) {
        conditions = and(conditions, eq(linearEvents.shouldAiReact, shouldReact === "true"));
      }

      const events = await db.query.linearEvents.findMany({
        where: conditions,
        orderBy: [desc(linearEvents.createdAt)],
        limit: limit,
      });

      return {
        success: true,
        data: {
          events: events.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            organizationId: e.organizationId,
            actorName: e.actorName,
            issueIdentifier: e.issueIdentifier,
            issueTitle: e.issueTitle,
            teamName: e.teamName,
            processed: e.processed,
            shouldAiReact: e.shouldAiReact,
            aiReactionTriggered: e.aiReactionTriggered,
            createdAt: e.createdAt,
            preview: getEventPreview(e),
          })),
          count: events.length,
        },
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        type: t.Optional(t.String()),
        processed: t.Optional(t.String()),
        shouldReact: t.Optional(t.String()),
      }),
    },
  )

  // Get single event
  .get(
    "/events/:id",
    async ({ params, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const event = await db.query.linearEvents.findFirst({
        where: and(eq(linearEvents.id, params.id), eq(linearEvents.userId, user.id)),
      });

      if (!event) {
        return { success: false, error: "Event not found" };
      }

      return {
        success: true,
        data: { event },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

  // Get event stats
  .get("/events/stats", async ({ user, isAuthenticated }) => {
    if (!isAuthenticated || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const events = await db.query.linearEvents.findMany({
      where: eq(linearEvents.userId, user.id),
    });

    const stats = {
      total: events.length,
      byType: {} as Record<string, number>,
      processed: events.filter((e) => e.processed).length,
      unprocessed: events.filter((e) => !e.processed).length,
      shouldReact: events.filter((e) => e.shouldAiReact).length,
      aiTriggered: events.filter((e) => e.aiReactionTriggered).length,
      recent: events.filter((e) => {
        if (!e.createdAt) return false;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return new Date(e.createdAt) > oneDayAgo;
      }).length,
    };

    events.forEach((event) => {
      stats.byType[event.eventType] = (stats.byType[event.eventType] || 0) + 1;
    });

    return {
      success: true,
      data: { stats },
    };
  })

  // Mark event as processed
  .post(
    "/events/:id/process",
    async ({ params, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      await db
        .update(linearEvents)
        .set({
          processed: true,
          processedAt: new Date(),
        })
        .where(and(eq(linearEvents.id, params.id), eq(linearEvents.userId, user.id)));

      return {
        success: true,
        message: "Event marked as processed",
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

  // Manually trigger AI reaction
  .post(
    "/events/:id/react",
    async ({ params, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const event = await db.query.linearEvents.findFirst({
        where: and(eq(linearEvents.id, params.id), eq(linearEvents.userId, user.id)),
      });

      if (!event) {
        return { success: false, error: "Event not found" };
      }

      // Trigger AI reaction
      const result = await processLinearEvent(event.id, {
        shouldReact: true,
        reason: "Manual trigger",
      });

      return {
        success: true,
        data: {
          message: "AI reaction triggered",
          result,
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  );

function getEventPreview(event: any): string {
  if (!event) return "No data";

  switch (event.eventType) {
    case "Issue":
      return `${event.issueIdentifier || "Issue"}: ${event.issueTitle || "No title"}`;
    case "Comment":
      return `Comment on ${event.issueIdentifier || "issue"}`;
    case "Cycle":
      return `Cycle: ${event.eventData?.data?.name || "Unknown"}`;
    case "Project":
      return `Project: ${event.projectName || "Unknown"}`;
    case "Team":
      return `Team: ${event.teamName || "Unknown"}`;
    default:
      return `${event.eventType}: ${event.actorName || "Unknown user"}`;
  }
}

/**
 * Process a Linear event and optionally trigger AI reactions
 * This runs asynchronously
 */
async function processLinearEvent(
  eventId: string,
  decision: { shouldReact: boolean; reason: string; suggestedAction?: string }
): Promise<any> {
  console.log(`🤖 Processing Linear event ${eventId}: ${decision.reason}`);

  try {
    const event = await db.query.linearEvents.findFirst({
      where: eq(linearEvents.id, eventId),
    });

    if (!event) {
      throw new Error("Event not found");
    }

    if (!event.userId) {
      throw new Error("No user associated with this event");
    }

    // TODO: Implement actual AI processing
    // This is where you would:
    // 1. Use Mastra to analyze the event
    // 2. Call Slack MCP tool to notify team
    // 3. Call GitHub MCP tool to create linked issue
    // 4. Generate AI summary/recommendations

    const result = {
      action: decision.suggestedAction || "analyze",
      timestamp: new Date().toISOString(),
      details: {
        eventType: event.eventType,
        issueIdentifier: event.issueIdentifier,
        issueTitle: event.issueTitle,
        actorName: event.actorName,
      },
      // Placeholder for actual AI processing
      message: `AI would react to ${event.eventType} event: ${decision.reason}`,
      recommendations: [],
    };

    // Update event with AI reaction result
    await db
      .update(linearEvents)
      .set({
        aiReactionTriggered: true,
        aiReactionResult: result,
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(linearEvents.id, eventId));

    console.log(`✅ AI reaction completed for event ${eventId}`);

    return result;
  } catch (error) {
    console.error(`❌ Error processing event ${eventId}:`, error);
    
    // Update event with error
    await db
      .update(linearEvents)
      .set({
        errorMessage: (error as Error).message,
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(linearEvents.id, eventId));

    throw error;
  }
}
