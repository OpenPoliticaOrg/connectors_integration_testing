import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  varchar,
  jsonb,
  decimal,
  index,
} from "drizzle-orm/pg-core";

// ==========================================
// Better Auth Tables
// ==========================================
export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  activeOrganizationId: text("active_organization_id"),
  impersonatedBy: text("impersonated_by"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: text("metadata"),
});

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => users.id),
});

export const twoFactors = pgTable("two_factors", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  enabled: boolean("enabled").default(false),
});

// ==========================================
// Connectors Tables
// ==========================================

// GitHub App Installations
export const githubInstallations = pgTable(
  "github_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    installationId: integer("installation_id").notNull(),
    accountLogin: varchar("account_login", { length: 255 }),
    accountType: varchar("account_type", { length: 50 }),
    repositories: jsonb("repositories").default([]),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    installationIdIdx: index("github_installations_installation_id_idx").on(table.installationId),
    userIdIdx: index("github_installations_user_id_idx").on(table.userId),
  }),
);

// Slack Connections
export const slackConnections = pgTable(
  "slack_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    botToken: text("bot_token").notNull(),
    botUserId: varchar("bot_user_id", { length: 100 }),
    teamId: varchar("team_id", { length: 100 }),
    teamName: varchar("team_name", { length: 255 }),
    scopes: text("scopes").array().notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("slack_connections_user_id_idx").on(table.userId),
    teamIdIdx: index("slack_connections_team_id_idx").on(table.teamId),
  }),
);

// Linear Connections
export const linearConnections = pgTable(
  "linear_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    linearUserId: varchar("linear_user_id", { length: 100 }),
    linearUserName: varchar("linear_user_name", { length: 255 }),
    linearOrganizationId: varchar("linear_organization_id", { length: 100 }),
    linearOrganizationName: varchar("linear_organization_name", { length: 255 }),
    scopes: text("scopes").array().notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("linear_connections_user_id_idx").on(table.userId),
    linearUserIdIdx: index("linear_connections_linear_user_id_idx").on(table.linearUserId),
  }),
);

// Slack Events - Stores all events from Slack
export const slackEvents = pgTable(
  "slack_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: varchar("team_id", { length: 100 }).notNull(),
    userId: text("user_id").references(() => users.id),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    eventId: varchar("event_id", { length: 255 }).notNull().unique(),
    eventTimestamp: decimal("event_timestamp", { precision: 16, scale: 6 }),
    channelId: varchar("channel_id", { length: 100 }),
    channelType: varchar("channel_type", { length: 50 }),
    userSlackId: varchar("user_slack_id", { length: 100 }),
    eventData: jsonb("event_data").notNull(),
    processed: boolean("processed").default(false),
    processedAt: timestamp("processed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    teamIdIdx: index("slack_events_team_id_idx").on(table.teamId),
    eventTypeIdx: index("slack_events_event_type_idx").on(table.eventType),
    eventIdIdx: index("slack_events_event_id_idx").on(table.eventId),
    processedIdx: index("slack_events_processed_idx").on(table.processed),
    createdAtIdx: index("slack_events_created_at_idx").on(table.createdAt),
  }),
);

// Linear Events - Stores all events from Linear
export const linearEvents = pgTable(
  "linear_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: varchar("organization_id", { length: 100 }).notNull(),
    userId: text("user_id").references(() => users.id),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    webhookId: varchar("webhook_id", { length: 255 }).notNull(),
    eventTimestamp: timestamp("event_timestamp").notNull(),
    actorId: varchar("actor_id", { length: 100 }),
    actorName: varchar("actor_name", { length: 255 }),
    issueId: varchar("issue_id", { length: 100 }),
    issueIdentifier: varchar("issue_identifier", { length: 100 }),
    issueTitle: varchar("issue_title", { length: 500 }),
    projectId: varchar("project_id", { length: 100 }),
    projectName: varchar("project_name", { length: 255 }),
    teamId: varchar("team_id", { length: 100 }),
    teamName: varchar("team_name", { length: 255 }),
    eventData: jsonb("event_data").notNull(),
    processed: boolean("processed").default(false),
    processedAt: timestamp("processed_at"),
    shouldAiReact: boolean("should_ai_react").default(false),
    aiReactionTriggered: boolean("ai_reaction_triggered").default(false),
    aiReactionResult: jsonb("ai_reaction_result"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("linear_events_organization_id_idx").on(table.organizationId),
    eventTypeIdx: index("linear_events_event_type_idx").on(table.eventType),
    webhookIdIdx: index("linear_events_webhook_id_idx").on(table.webhookId),
    issueIdIdx: index("linear_events_issue_id_idx").on(table.issueId),
    processedIdx: index("linear_events_processed_idx").on(table.processed),
    shouldAiReactIdx: index("linear_events_should_ai_react_idx").on(table.shouldAiReact),
    createdAtIdx: index("linear_events_created_at_idx").on(table.createdAt),
  }),
);

// Tools table
export const tools = pgTable("tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  description: text("description").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  requiredScopes: text("required_scopes").array().notNull().default([]),
  parameters: jsonb("parameters").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User tools allowlist
export const userTools = pgTable(
  "user_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    toolName: varchar("tool_name", { length: 100 }).notNull(),
    isEnabled: boolean("is_enabled").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userToolIdx: index("user_tools_user_tool_idx").on(table.userId, table.toolName),
  }),
);

// Agent runs
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    status: varchar("status", { length: 50 }).default("pending"),
    prompt: text("prompt").notNull(),
    response: text("response"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    model: varchar("model", { length: 100 }),
    toolsUsed: text("tools_used").array(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("agent_runs_user_id_idx").on(table.userId),
    statusIdx: index("agent_runs_status_idx").on(table.status),
  }),
);

// Tool calls audit log
export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id),
    toolName: varchar("tool_name", { length: 100 }).notNull(),
    parameters: jsonb("parameters").notNull(),
    result: jsonb("result"),
    status: varchar("status", { length: 50 }).default("pending"),
    errorMessage: text("error_message"),
    scopesChecked: text("scopes_checked").array(),
    scopesPassed: boolean("scopes_passed"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    runIdx: index("tool_calls_run_idx").on(table.agentRunId),
  }),
);

// ==========================================
// Types
// ==========================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Member = typeof members.$inferSelect;
export type GithubInstallation = typeof githubInstallations.$inferSelect;
export type SlackConnection = typeof slackConnections.$inferSelect;
export type SlackEvent = typeof slackEvents.$inferSelect;
export type LinearConnection = typeof linearConnections.$inferSelect;
export type LinearEvent = typeof linearEvents.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type UserTool = typeof userTools.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type ToolCall = typeof toolCalls.$inferSelect;
