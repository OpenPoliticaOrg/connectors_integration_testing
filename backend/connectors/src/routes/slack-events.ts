import { Elysia, t } from "elysia";
import { db, schema } from "@backend/db";
import { eq, and, desc } from "drizzle-orm";
import { jwtAuthMiddleware } from "@/middleware/jwt-auth";

const { slackEvents, slackConnections } = schema;

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || "";

/**
 * Verify Slack request signature
 */
function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.warn("SLACK_SIGNING_SECRET not set, skipping verification");
    return true;
  }

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = new Bun.CryptoHasher("sha256", SLACK_SIGNING_SECRET);
  hmac.update(baseString);
  const expectedSignature = `v0=${hmac.digest("hex")}`;

  return signature === expectedSignature;
}

export const slackEventsRoutes = new Elysia({ prefix: "/slack" })
  // ==========================================
  // SLACK EVENTS WEBHOOK - NO AUTH (signature verified)
  // ==========================================

  .post(
    "/events",
    async ({ request, body }) => {
      const rawBody = JSON.stringify(body);
      const timestamp = request.headers.get("x-slack-request-timestamp") || "";
      const signature = request.headers.get("x-slack-signature") || "";

      if (!verifySlackSignature(rawBody, timestamp, signature)) {
        return { success: false, error: "Invalid signature" };
      }

      const eventData = body as any;

      if (eventData.type === "url_verification") {
        console.log("🔐 Slack URL verification challenge");
        return { challenge: eventData.challenge };
      }

      if (eventData.type === "event_callback") {
        const { event, team_id, event_id, event_time } = eventData;

        const existing = await db.query.slackEvents.findFirst({
          where: eq(slackEvents.eventId, event_id),
        });

        if (existing) {
          console.log(`⏭️ Duplicate event ${event_id}, skipping`);
          return { success: true, message: "Duplicate event" };
        }

        const connection = await db.query.slackConnections.findFirst({
          where: eq(slackConnections.teamId, team_id),
        });

        await db.insert(slackEvents).values({
          teamId: team_id,
          userId: connection?.userId,
          eventType: event.type,
          eventId: event_id,
          eventTimestamp: event_time.toString(),
          channelId: event.channel || event.item?.channel,
          channelType: event.channel_type,
          userSlackId: event.user,
          eventData: event,
          processed: false,
        });

        console.log(`✅ Stored Slack event: ${event.type} (${event_id})`);

        return { success: true };
      }

      return { success: true, message: "Unknown event type" };
    },
    {
      body: t.Object({
        type: t.String(),
        token: t.Optional(t.String()),
        team_id: t.Optional(t.String()),
        api_app_id: t.Optional(t.String()),
        event: t.Optional(t.Any()),
        event_id: t.Optional(t.String()),
        event_time: t.Optional(t.Number()),
        challenge: t.Optional(t.String()),
      }),
    },
  )

  // ==========================================
  // API ROUTES - REQUIRES JWT AUTH
  // ==========================================

  .use(jwtAuthMiddleware)

  .get(
    "/events",
    async ({ query, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const limit = parseInt(query.limit || "50");
      const eventType = query.type;

      let conditions: any = eq(slackEvents.userId, user.id);

      if (eventType) {
        conditions = and(conditions, eq(slackEvents.eventType, eventType));
      }

      const events = await db.query.slackEvents.findMany({
        where: conditions,
        orderBy: [desc(slackEvents.createdAt)],
        limit: limit,
      });

      return {
        success: true,
        data: {
          events: events.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            channelId: e.channelId,
            userSlackId: e.userSlackId,
            teamId: e.teamId,
            processed: e.processed,
            createdAt: e.createdAt,
            preview: getEventPreview(e.eventData),
          })),
          count: events.length,
        },
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        type: t.Optional(t.String()),
      }),
    },
  )

  .get(
    "/events/:id",
    async ({ params, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      const event = await db.query.slackEvents.findFirst({
        where: and(eq(slackEvents.id, params.id), eq(slackEvents.userId, user.id)),
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

  .get("/events/stats", async ({ user, isAuthenticated }) => {
    if (!isAuthenticated || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const events = await db.query.slackEvents.findMany({
      where: eq(slackEvents.userId, user.id),
    });

    const stats = {
      total: events.length,
      byType: {} as Record<string, number>,
      processed: events.filter((e) => e.processed).length,
      unprocessed: events.filter((e) => !e.processed).length,
    };

    events.forEach((event) => {
      stats.byType[event.eventType] = (stats.byType[event.eventType] || 0) + 1;
    });

    return {
      success: true,
      data: { stats },
    };
  })

  .post(
    "/events/:id/process",
    async ({ params, user, isAuthenticated }) => {
      if (!isAuthenticated || !user) {
        return { success: false, error: "Unauthorized" };
      }

      await db
        .update(slackEvents)
        .set({
          processed: true,
          processedAt: new Date(),
        })
        .where(and(eq(slackEvents.id, params.id), eq(slackEvents.userId, user.id)));

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
  );

function getEventPreview(eventData: any): string {
  if (!eventData) return "No data";

  switch (eventData.type) {
    case "message":
      return eventData.text ? eventData.text.substring(0, 100) : "Empty message";
    case "reaction_added":
      return `Reaction: ${eventData.reaction}`;
    case "channel_created":
      return `Channel: ${eventData.channel?.name}`;
    case "member_joined_channel":
      return `User joined: ${eventData.user}`;
    case "app_mention":
      return `Mention: ${eventData.text?.substring(0, 100)}`;
    default:
      return `Event: ${eventData.type}`;
  }
}
