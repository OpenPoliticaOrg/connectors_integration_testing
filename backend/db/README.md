# @backend/db

Shared database package for all backend services. This package contains the Drizzle ORM schema and database connection that is used by both `@backend/auth` and `@backend/connectors`.

## 📁 Structure

```
.
├── src/
│   ├── index.ts      # Database connection and exports
│   └── schema.ts     # All database tables (auth + connectors)
├── package.json
└── drizzle.config.ts # Migration configuration
```

## 🗄️ Database Schema

### Auth Tables (Better Auth)

- `users` - User accounts
- `sessions` - Active sessions
- `accounts` - OAuth accounts (GitHub, Google)
- `verifications` - Email verification tokens
- `organizations` - Multi-tenant organizations
- `members` - Organization memberships
- `invitations` - Organization invitations
- `two_factors` - 2FA settings

### Connectors Tables

- `github_installations` - GitHub App installations
- `slack_connections` - Slack OAuth connections
- `slack_events` - Slack webhook events
- `tools` - Available MCP tools
- `user_tools` - User-enabled tools
- `agent_runs` - AI agent execution runs
- `tool_calls` - Tool execution audit log

## 🚀 Usage

### In Other Packages

```typescript
// Import the database and schema
import { db, schema } from "@backend/db";

// Use in your code
const { users, githubInstallations } = schema;

// Query
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
});

// Insert
await db.insert(githubInstallations).values({
  userId,
  installationId: 12345,
  // ...
});
```

## 🔧 Database Operations

Run these from the monorepo root or from within this package:

```bash
# Generate migrations
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema changes (development)
bun run db:push

# Open Drizzle Studio
bun run db:studio
```

## 📝 Environment Variables

Make sure to set the following in your `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/auth_db
```

## 🔗 Workspace Dependencies

This package is used by:

- `@backend/auth` - Authentication service
- `@backend/connectors` - AI agent connectors service

Both services share the same database schema and connection, ensuring data consistency across the backend.
