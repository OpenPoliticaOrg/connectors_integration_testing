# Agent Instructions

This is a **Turborepo monorepo** containing backend services for AI-powered connectors. This file provides an overview and links to package-specific instructions.

## Project Structure

```
.
├── backend/
│   ├── auth/              # @backend/auth - Authentication service
│   ├── connectors/        # @backend/connectors - AI agent connectors
│   └── db/                # @backend/db - Database package
├── packages/
│   ├── eslint-config/     # Shared ESLint configurations
│   ├── typescript-config/ # Shared TypeScript configurations
│   └── ui/                # Shared UI components
├── package.json           # Root package configuration
├── turbo.json             # Turborepo configuration
└── AGENTS.md              # This file
```

## Package-Specific Instructions

| Package                 | Path                                                           | Description                                        |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| **@backend/auth**       | [`backend/auth/AGENTS.md`](backend/auth/AGENTS.md)             | Authentication with Better Auth, JWT, Resend email |
| **@backend/connectors** | [`backend/connectors/AGENTS.md`](backend/connectors/AGENTS.md) | AI agent connectors for Slack/GitHub               |
| **@backend/db**         | [`backend/db/AGENTS.md`](backend/db/AGENTS.md)                 | Database schema, Drizzle ORM, migrations           |

## Quick Commands

```bash
# Install dependencies (from root)
bun install

# Run all services in dev mode
bun run dev

# Run specific package
bun run --filter=@backend/auth dev
bun run --filter=@backend/db dev
bun run --filter=@backend/connectors dev

# Build all packages
bun run build

# Lint all packages
bun run lint

# Type check all packages
bun run check-types
```

## Technology Stack

- **Runtime**: Bun
- **Framework**: Elysia.js
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Better Auth
- **Monorepo**: Turborepo

## Common Patterns

### Workspace Imports

```typescript
// Import from @backend/db
import { db, schema } from "@backend/db";
import type { User } from "@backend/db";
```

### Running Database Commands

```bash
cd backend/db/
bun run db:generate    # Generate migrations
bun run db:migrate     # Run migrations
bun run db:studio      # Open Drizzle Studio
```

### Code Quality

Before committing, run in each modified package:

```bash
bun run lint
bun run typecheck
```

## Environment Setup

Each package has its own `.env.example` file. Copy and configure:

```bash
cp backend/auth/.env.example backend/auth/.env
cp backend/connectors/.env.example backend/connectors/.env
cp backend/db/.env.example backend/db/.env
```

## Key Conventions

- Use `.js` extensions for all imports
- Use `camelCase` for functions/variables
- Use `PascalCase` for types/interfaces
- Use `snake_case` for database tables
- Always use strict TypeScript
- Never use `any` types
