# Agent Instructions for Database Package (@backend/db)

## Build & Development Commands

```bash
# Database operations
db:generate     # Generate migrations from schema changes
db:migrate      # Run pending migrations
db:push         # Push schema directly (dev only - no migration files)
db:studio       # Open Drizzle Studio GUI

# Code quality
bun run lint           # Run ESLint
bun run typecheck      # TypeScript check (no emit)
```

**Note:** This package uses Bun runtime. All database operations use drizzle-kit.

## Code Style Guidelines

### Imports

- **Use `@/` path alias for internal imports** (e.g., `import { schema } from "@/schema"`)
- **No file extensions needed** - TypeScript handles this automatically
- Group imports: 1) external libs, 2) internal `@/*` modules, 3) types
- Export schema from index.ts for use by other packages

**Examples:**
```typescript
// ✅ CORRECT - Use @/ path alias
import * as schema from "@/schema";
export * from "@/schema";

// ❌ AVOID - Don't use relative paths with extensions
import * as schema from "./schema.js";
export * from "./schema.js";
```

### TypeScript

- Enable `strict: true` - no `any` types allowed
- Use `noUncheckedIndexedAccess: true` - handle potentially undefined values
- Always export table types using Drizzle's `$inferSelect` and `$inferInsert`

### Naming Conventions

- Files: kebab-case (e.g., `schema.ts`)
- Database tables: snake_case (enforced by Drizzle)
- TypeScript exports: PascalCase (e.g., `User`, `NewUser`)
- Column names: snake_case in DB, camelCase in code

### Database Schema Patterns

```typescript
// Always add indexes for foreign keys and frequently queried fields
export const tableName = pgTable(
  "table_name",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("table_name_user_id_idx").on(table.userId),
  }),
);

// Export types for the table
export type TableName = typeof tableName.$inferSelect;
export type NewTableName = typeof tableName.$inferInsert;
```

### Table Categories

1. **Better Auth Tables**: users, sessions, accounts, verifications, organizations, members, invitations, twoFactors
2. **Connector Tables**: githubInstallations, slackConnections, slackEvents
3. **Tool Tables**: tools, userTools
4. **Audit Tables**: agentRuns, toolCalls

### Index Guidelines

Always add indexes for:

- Foreign key columns (e.g., `user_id`, `organization_id`)
- Frequently queried fields (e.g., `event_type`, `status`)
- Unique identifiers (e.g., `event_id`, `installation_id`)
- Timestamps used for sorting (e.g., `created_at`)

### Column Types

- IDs: `uuid` with `.defaultRandom()` or `text` for Better Auth
- Timestamps: `timestamp("created_at").defaultNow()`
- JSON data: `jsonb` for flexible schemas
- Arrays: `text("scopes").array()`
- Booleans: `boolean("is_active").default(true)`
- Enums: Use `varchar` with TypeScript union types

### Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- Format: `postgresql://user:password@host:port/database`

### Security

- Never store plain text passwords (Better Auth handles hashing)
- Encrypt sensitive tokens before storing (not in this package)
- Use foreign key constraints for data integrity
- Never commit `.env` files

### Migrations

1. **Development**: Use `bun run db:push` for quick iterations
2. **Production**: Use `bun run db:generate` then `bun run db:migrate`
3. **Review**: Always review generated migration files before applying
4. **Backup**: Backup production DB before running migrations

### Workspace Usage

Other packages import from this package:

```typescript
// Import schema and db
import { db, schema } from "@backend/db";

// Import specific types
import type { User, SlackConnection } from "@backend/db";

// Usage
const user = await db.query.users.findFirst({
  where: eq(schema.users.id, userId),
});
```

### Git Workflow

- Schema changes should be in their own commit: `feat(db): add user_tools table`
- Generate migrations after schema changes
- Test migrations on a fresh database before committing
