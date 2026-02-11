# Agent Instructions for AI Agent Connectors

## Build & Development Commands

```bash
# Development server with hot reload
bun run dev

# Production build
bun run start

# Database operations
bun run db:generate     # Generate migrations
bun run db:migrate      # Run migrations
bun run db:push         # Push schema changes
bun run db:studio       # Open Drizzle Studio

# Code quality
bun run lint           # Run ESLint
bun run typecheck      # TypeScript check (no emit)
```

**Note:** This project uses Bun runtime, not Node.js.

## Code Style Guidelines

### Imports

- Use `.js` extensions for all imports (e.g., `import { foo } from "./bar.js"`)
- Group imports: 1) external libs, 2) internal modules, 3) types
- Use path alias `@/*` for src directory imports

### TypeScript

- Enable `strict: true` - no `any` types allowed
- Always specify return types for exported functions
- Use `type` imports: `import type { Foo } from "..."`
- Prefer interfaces for object shapes, types for unions

### Naming Conventions

- Files: kebab-case (e.g., `slack-events.ts`)
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE for true constants
- Database tables: snake_case (enforced by Drizzle)
- Types/Interfaces: PascalCase

### Error Handling

- Always use try/catch for async operations
- Return consistent error format: `{ success: false, error: string }`
- Log errors with context before returning
- Use Zod for runtime validation of request bodies

### Database

- Use Drizzle ORM with PostgreSQL
- Always define indexes for foreign keys and frequently queried fields
- Use transactions for multi-table operations
- Never store plain text secrets (encrypt tokens)

### API Routes (Elysia)

```typescript
export const routes = new Elysia({ prefix: "/path" }).get(
  "/endpoint",
  async ({ query, jwt }) => {
    // Validate auth
    // Process request
    // Return { success: true, data: {} }
  },
  {
    query: t.Object({ param: t.String() }), // Zod validation
  },
);
```

### Environment Variables

- Access via `process.env.VAR_NAME`
- Use `!` for required vars, provide defaults for optional
- Never commit `.env` files

### Comments

- Use JSDoc for exported functions
- Section headers: `// ==========================================`
- Explain WHY, not WHAT (code should be self-documenting)

### Security

- Verify JWT on all protected routes
- Validate Slack/GitHub webhook signatures
- Never log sensitive data (tokens, passwords)
- Use parameterized queries (Drizzle handles this)

### Testing

- Use Bun's built-in test runner: `bun test`
- Run single test: `bun test path/to/test.ts`
- Mock external APIs in tests
- Test error cases, not just happy paths

### Git Workflow

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- One logical change per commit
- Run `bun run lint && bun run typecheck` before committing
