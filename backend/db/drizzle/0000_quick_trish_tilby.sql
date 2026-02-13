CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"prompt" text NOT NULL,
	"response" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"model" varchar(100),
	"tools_used" text[],
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" integer NOT NULL,
	"account_login" varchar(255),
	"account_type" varchar(50),
	"repositories" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending',
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "linear_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"linear_user_id" varchar(100),
	"linear_user_name" varchar(255),
	"linear_organization_id" varchar(100),
	"linear_organization_name" varchar(255),
	"scopes" text[] NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "linear_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(100) NOT NULL,
	"user_id" text,
	"event_type" varchar(100) NOT NULL,
	"webhook_id" varchar(255) NOT NULL,
	"event_timestamp" timestamp NOT NULL,
	"actor_id" varchar(100),
	"actor_name" varchar(255),
	"issue_id" varchar(100),
	"issue_identifier" varchar(100),
	"issue_title" varchar(500),
	"project_id" varchar(100),
	"project_name" varchar(255),
	"team_id" varchar(100),
	"team_name" varchar(255),
	"event_data" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"should_ai_react" boolean DEFAULT false,
	"ai_reaction_triggered" boolean DEFAULT false,
	"ai_reaction_result" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp DEFAULT now(),
	"metadata" text,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"active_organization_id" text,
	"impersonated_by" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "slack_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bot_token" text NOT NULL,
	"bot_user_id" varchar(100),
	"team_id" varchar(100),
	"team_name" varchar(255),
	"scopes" text[] NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "slack_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" varchar(100) NOT NULL,
	"user_id" text,
	"event_type" varchar(100) NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_timestamp" numeric(16, 6),
	"channel_id" varchar(100),
	"channel_type" varchar(50),
	"user_slack_id" varchar(100),
	"event_data" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "slack_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_run_id" uuid,
	"tool_name" varchar(100) NOT NULL,
	"parameters" jsonb NOT NULL,
	"result" jsonb,
	"status" varchar(50) DEFAULT 'pending',
	"error_message" text,
	"scopes_checked" text[],
	"scopes_passed" boolean,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"provider" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"required_scopes" text[] DEFAULT '{}' NOT NULL,
	"parameters" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tools_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"enabled" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "user_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tool_name" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"email_verified" boolean DEFAULT false,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_connections" ADD CONSTRAINT "linear_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_events" ADD CONSTRAINT "linear_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_events" ADD CONSTRAINT "slack_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tools" ADD CONSTRAINT "user_tools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_user_id_idx" ON "agent_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "github_installations_installation_id_idx" ON "github_installations" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "github_installations_user_id_idx" ON "github_installations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "linear_connections_user_id_idx" ON "linear_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "linear_connections_linear_user_id_idx" ON "linear_connections" USING btree ("linear_user_id");--> statement-breakpoint
CREATE INDEX "linear_events_organization_id_idx" ON "linear_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "linear_events_event_type_idx" ON "linear_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "linear_events_webhook_id_idx" ON "linear_events" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "linear_events_issue_id_idx" ON "linear_events" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "linear_events_processed_idx" ON "linear_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "linear_events_should_ai_react_idx" ON "linear_events" USING btree ("should_ai_react");--> statement-breakpoint
CREATE INDEX "linear_events_created_at_idx" ON "linear_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "slack_connections_user_id_idx" ON "slack_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "slack_connections_team_id_idx" ON "slack_connections" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "slack_events_team_id_idx" ON "slack_events" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "slack_events_event_type_idx" ON "slack_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "slack_events_event_id_idx" ON "slack_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "slack_events_processed_idx" ON "slack_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "slack_events_created_at_idx" ON "slack_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tool_calls_run_idx" ON "tool_calls" USING btree ("agent_run_id");--> statement-breakpoint
CREATE INDEX "user_tools_user_tool_idx" ON "user_tools" USING btree ("user_id","tool_name");