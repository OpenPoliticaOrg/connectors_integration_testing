# Agent Instructions - Database Package (@backend/db)

## Package Overview

Shared database package providing PostgreSQL access via Drizzle ORM for all backend services.

**Stack:** Drizzle ORM + PostgreSQL + drizzle-kit

## Key Patterns

### Schema Organization

**Better Auth Tables:**
- Core: users, sessions, accounts, verifications
- Organizations: organizations, members, invitations
- 2FA: twoFactors

**Application Tables:**
- OAuth connections: githubInstallations, slackConnections, linearConnections
- Events: slackEvents, linearEvents
- AI: agentRuns, toolCalls
- Tools: tools, userTools

### Table Definition Pattern

Always include:
1. UUID primary key with defaultRandom()
2. Foreign key references with constraints
3. Created_at timestamp with defaultNow()
4. Indexes on foreign keys and query fields
5. Type exports ($inferSelect, $inferInsert)

### Column Types

- IDs: `uuid` (app tables) or `text` (Better Auth tables)
- Timestamps: `timestamp` with defaultNow()
- JSON: `jsonb` for flexible data
- Arrays: `text().array()` for scopes/tags
- Booleans: `boolean` with default
- Enums: `varchar` with TypeScript unions

### Index Guidelines

Always index:
- Foreign key columns (user_id, organization_id)
- Unique identifiers (event_id, installation_id)
- Frequently queried fields (event_type, status)
- Sort fields (created_at)

## Development Commands

```bash
# Generate migration from schema changes
bun run db:generate

# Apply pending migrations
bun run db:migrate

# Push schema directly (dev only, no migration files)
bun run db:push

# Open Drizzle Studio GUI
bun run db:studio

# Type check
bun run typecheck
```

## Common Tasks

### Adding New Table

1. Define table in `src/schema.ts` following patterns
2. Add indexes for foreign keys and query fields
3. Export types ($inferSelect, $inferInsert)
4. Run `bun run db:generate`
5. Review generated migration
6. Run `bun run db:migrate`
7. Commit schema.ts and migration files

### Modifying Existing Table

1. Update schema.ts with new columns/indexes
2. Consider data migration needs
3. Generate and review migration
4. Test migration on fresh database
5. Apply and commit

### Better Auth Schema Updates

1. Check Better Auth plugin documentation for table requirements
2. Add/modify tables in schema.ts
3. Ensure column names match Better Auth expectations
4. Map tables in auth service's Better Auth config
5. Re-run migrations

## Schema Change Workflow

**Development iteration:**
```bash
cd backend/db
bun run db:push  # Quick schema push, no files
```

**Production-ready:**
```bash
cd backend/db
bun run db:generate  # Create migration file
# Review migration file
bun run db:migrate   # Apply migration
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

Format must include:
- Protocol: `postgresql://`
- User and password
- Host and port
- Database name

## Code Standards

### Imports
- Use `@/` path alias for internal imports
- No file extensions in imports
- Group: external libs, internal @/, types

### Naming
- Files: kebab-case
- Tables: snake_case
- TypeScript exports: PascalCase
- Columns: snake_case in DB, camelCase in code

### TypeScript
- strict: true
- noUncheckedIndexedAccess: true
- No any types

## Workspace Usage

Other packages import:
```typescript
import { db, schema } from "@backend/db"
import type { User, AgentRun } from "@backend/db"
```

The package exports:
- `db` - Drizzle database client
- `schema` - All table definitions
- Types for all tables

## Security

- Never store plain text passwords (Better Auth handles this)
- Encrypt sensitive tokens in application layer (not this package)
- Use foreign key constraints for data integrity
- Never commit .env files

## Git Workflow

- Schema changes in dedicated commits
- Commit both schema.ts and migrations/
- Test migrations before committing
- Use descriptive commit messages: "feat(db): add user_tools table"

## Troubleshooting

**Migration fails:**
- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check user has permissions
- Review migration SQL for issues

**Schema drift:**
- Regenerate migrations
- Use db:push for development reset
- Never modify existing migration files

**Type errors:**
- Ensure schema.ts exports types correctly
- Check imports use @backend/db
- Run typecheck to identify issues

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle Kit Migrations](https://orm.drizzle.team/docs/migrations)
- [Better Auth Tables](https://better-auth.com/docs/concepts/database)
