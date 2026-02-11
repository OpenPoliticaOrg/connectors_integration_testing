# Agent Instructions for AI Agent Connectors

## TypeScript Configuration

This project uses a modern TypeScript setup for clean imports and full type safety:

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Key Features:**
- `@/*` path alias maps to `src/` directory
- No `.js` extensions needed in imports
- Full IntelliSense and type checking
- Works with both development and production builds

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

- **Use `@/` path alias for internal imports** (e.g., `import { foo } from "@/lib/utils"`)
- **No file extensions needed** - TypeScript handles this automatically
- Group imports: 1) external libs, 2) internal `@/*` modules, 3) types
- Always use `@/` for imports from `src/` directory

**Examples:**
```typescript
// ✅ CORRECT - Use @/ path alias
import { encrypt } from "@/lib/encryption";
import { jwtAuthMiddleware } from "@/middleware/jwt-auth";
import { linearEventsRoutes } from "@/routes/linear-events";

// ❌ AVOID - Don't use relative paths with extensions
import { encrypt } from "../lib/encryption.js";
import { jwtAuthMiddleware } from "../middleware/jwt-auth.js";
```

### TypeScript Configuration

The project uses `bundler` module resolution for clean imports:
- `module: "ES2022"` - Modern ES modules
- `moduleResolution: "bundler"` - Supports clean `@/` imports
- `baseUrl: "."` - Root directory for path resolution
- `paths: { "@/*": ["./src/*"] }` - Maps `@/` to `src/` directory

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
- Validate Slack/GitHub/Linear webhook signatures
- Never log sensitive data (tokens, passwords)
- Use parameterized queries (Drizzle handles this)

## Linear MCP Integration

This package includes full Linear integration via MCP (Model Context Protocol) and webhooks.

### Components

1. **Linear MCP Server** (`src/mcp/linear.ts`)
   - Stateless GraphQL client for Linear API
   - 7 tools: list/get/create/update issues, teams, projects, search
   - Tool-level authorization (read/write scopes)
   - Receives OAuth tokens per-request (no token storage)

2. **Linear OAuth Routes** (`src/routes/oauth.ts`)
   - `GET /oauth/linear` - Initiate OAuth flow with PKCE
   - `GET /oauth/linear/callback` - OAuth callback with PKCE verification
   - `POST /oauth/linear/link` - Link connection to user
   - Supports disconnect and connection status
   - Tokens encrypted before database storage

3. **Linear Events/Webhooks** (`src/routes/linear-events.ts`)
   - `POST /linear/webhook` - Receive Linear webhooks
   - `GET /linear/events` - List events with filters
   - `GET /linear/events/stats` - Event statistics
   - `POST /linear/events/:id/react` - Trigger AI reaction
   - Automatic AI reaction detection based on priority/mentions/state

4. **Agent Integration** (`src/routes/agent.ts`)
   - Checks for Linear connection before running agent
   - Auto-refreshes expired tokens
   - Passes decrypted OAuth tokens securely to MCP server
   - Passes scopes for authorization checks
   - Tokens never exposed to LLM

5. **Security Libraries**
   - `src/lib/encryption.ts` - AES-256-GCM token encryption
   - `src/lib/pkce.ts` - PKCE code verifier/challenge generation
   - `src/lib/token-refresh.ts` - Automatic token refresh logic

### Environment Variables

```bash
# OAuth
LINEAR_CLIENT_ID=xxx
LINEAR_CLIENT_SECRET=xxx
LINEAR_REDIRECT_URI=http://localhost:3000/oauth/linear/callback

# MCP Server
LINEAR_MCP_URL=http://localhost:3003/sse

# Webhooks
LINEAR_WEBHOOK_SECRET=xxx
```

### Database Tables

- `linear_connections` - OAuth tokens and user/org info
- `linear_events` - Webhook events with AI reaction tracking

### Security Model

**Token Encryption (AES-256-GCM)**
- OAuth tokens encrypted at rest using `src/lib/encryption.ts`
- Uses 32-byte key from `ENCRYPTION_KEY` environment variable
- Generates unique salt and IV for each encryption
- Authenticated encryption prevents tampering

**OAuth 2.1 + PKCE**
- PKCE (Proof Key for Code Exchange) implemented for OAuth flow
- Generates code_verifier and code_challenge
- Prevents authorization code interception attacks
- Required by MCP 2025 specification

**Tool-Level Authorization**
- Read operations require `read` scope
- Write operations require `write` scope
- Admin scope bypasses all checks
- Enforced in MCP server before API calls

**Token Auto-Refresh**
- Automatically refreshes expired tokens (5-min buffer)
- Uses refresh_token to get new access_token
- Updates encrypted tokens in database
- Happens transparently during agent execution

**Token Flow**
- OAuth tokens stored encrypted in database
- Tokens passed via `_oauthToken` context field (invisible to LLM)
- Scopes passed via `_scopes` for authorization checks
- MCP server is stateless - no token persistence
- Webhook signatures verified via Authorization header

### Testing

```bash
# Test OAuth flow
curl http://localhost:3000/oauth/linear

# Test webhooks
curl -X POST http://localhost:3000/linear/webhook \
  -H "Authorization: Bearer $LINEAR_WEBHOOK_SECRET" \
  -d '{"type": "Issue", "data": {...}}'

# List events requiring AI reaction
curl "http://localhost:3000/linear/events?shouldReact=true" \
  -H "Authorization: Bearer <jwt>"
```

### Testing

- Use Bun's built-in test runner: `bun test`
- Run single test: `bun test path/to/test.ts`
- Mock external APIs in tests
- Test error cases, not just happy paths

### Git Workflow

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- One logical change per commit
- Run `bun run lint && bun run typecheck` before committing
