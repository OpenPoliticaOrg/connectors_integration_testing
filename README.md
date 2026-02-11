# AI Agent Connectors

Backend services for AI-powered integrations with Slack, GitHub, and other platforms.

## What's This?

This project provides backend services that connect AI agents to external platforms like Slack and GitHub. Think of it as the "bridge" between AI systems and the tools teams use every day.

**Example**: An AI agent can read Slack messages, understand what's happening, and help teams coordinate better.

## Project Structure

```
.
├── backend/                    # All backend services
│   ├── auth/                   # Authentication service (@backend/auth)
│   │   └── Handles user login, JWT tokens, email verification
│   ├── connectors/             # AI connectors service (@backend/connectors)
│   │   └── Connects to Slack/GitHub, runs AI agents
│   └── db/                     # Database package (@backend/db)
│       └── Database schema and connection
│
└── packages/                   # Shared code
    ├── eslint-config/          # Linting rules
    ├── typescript-config/      # TypeScript settings
    └── ui/                     # Shared UI components
```

## Quick Start

### 1. Install Dependencies

```bash
# Install Bun first (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install all dependencies
bun install
```

### 2. Set Up Environment Variables

Each service needs its own `.env` file:

```bash
# Database
cp backend/db/.env.example backend/db/.env

# Auth service
cp backend/auth/.env.example backend/auth/.env

# Connectors service
cp backend/connectors/.env.example backend/connectors/.env
```

Edit each `.env` file with your settings (database URLs, API keys, etc.)

### 3. Set Up Database

```bash
cd backend/db

# Create database tables
bun run db:push

# Or generate and run migrations
bun run db:generate
bun run db:migrate
```

### 4. Run Services

```bash
# From root directory - run everything
bun run dev

# Or run specific services
bun run --filter=@backend/auth dev
bun run --filter=@backend/connectors dev
```

Services will start:

- Auth service: http://localhost:3000
- Connectors service: http://localhost:3001

## Common Commands

```bash
# Run all services
bun run dev

# Build for production
bun run build

# Check code quality
bun run lint
bun run check-types

# Database operations
cd backend/db
bun run db:generate     # Generate migrations
bun run db:migrate      # Run migrations
bun run db:studio       # Open database GUI
```

## Technology Stack

| Technology      | Purpose                                      |
| --------------- | -------------------------------------------- |
| **Bun**         | JavaScript runtime (like Node.js but faster) |
| **Elysia**      | Web framework for building APIs              |
| **Drizzle ORM** | Database toolkit for PostgreSQL              |
| **Better Auth** | Authentication library                       |
| **Turborepo**   | Monorepo management                          |
| **PostgreSQL**  | Database                                     |

## How It Works

1. **Auth Service** (`@backend/auth`)
   - Handles user authentication
   - Issues JWT tokens
   - Manages email verification
   - Provides `/api/auth/*` endpoints

2. **Connectors Service** (`@backend/connectors`)
   - Connects to external APIs (Slack, GitHub)
   - Runs AI agents to process data
   - Stores results in database
   - Validates JWT tokens from auth service

3. **Database Package** (`@backend/db`)
   - Defines database tables (users, sessions, events, etc.)
   - Provides database connection
   - Shared across all services

## Example: Adding a New Feature

Let's say you want to add GitHub integration:

1. **Add database table** in `backend/db/src/schema.ts`:

```typescript
export const githubRepos = pgTable("github_repos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id),
  repoName: text("repo_name"),
});
```

2. **Run migrations**:

```bash
cd backend/db
bun run db:generate
bun run db:migrate
```

3. **Add API route** in `backend/connectors/src/routes/`:

```typescript
// github.ts
import { Elysia } from "elysia";

export const githubRoutes = new Elysia({ prefix: "/github" }).get("/repos", async () => {
  // Fetch repos from GitHub API
  return { repos: [] };
});
```

4. **Register route** in `backend/connectors/src/main.ts`:

```typescript
import { githubRoutes } from "./routes/github.js";

app.use(githubRoutes);
```

## Development Workflow

1. **Make changes** to the code
2. **Run linter**: `bun run lint`
3. **Type check**: `bun run typecheck`
4. **Test**: Run the service and test endpoints
5. **Commit**: Use conventional commits (`feat:`, `fix:`, `docs:`)

## Troubleshooting

### "Cannot find module '@backend/db'"

Run `bun install` from root to link workspace packages.

### Database connection errors

Check `backend/db/.env` has correct `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### Port already in use

Change port in the service's `.env` file:

```env
PORT=3002  # Use different port
```

## For AI Agents

If you're an AI agent working on this codebase, read:

- [`AGENTS.md`](./AGENTS.md) - Overview and quick reference
- `backend/*/AGENTS.md` - Package-specific instructions

## License

MIT
