# Agent Instructions for Auth Service

## Build & Development Commands

```bash
# Development server with hot reload
bun run dev

# Production build
bun run start

# Code quality
bun run lint           # Run ESLint
bun run typecheck      # TypeScript check (no emit)
```

**Note:** This project uses Bun runtime, not Node.js.

## TypeScript Configuration

The auth service uses `@/` path aliases for clean imports:

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

**Note:** Due to complex JWT type inference with @elysiajs/jwt, some TypeScript warnings may appear. These are known limitations and do not affect runtime functionality.

## Code Style Guidelines

### Imports

- **Use `@/` path alias for internal imports** (e.g., `import { auth } from "@/lib/auth"`)
- **No file extensions needed** - TypeScript handles this automatically
- Group imports: 1) external libs, 2) internal `@/*` modules, 3) types
- Use workspace alias `@backend/db` for shared database package

**Examples:**
```typescript
// ✅ CORRECT - Use @/ path alias
import { auth } from "@/lib/auth";
import { authRoutes } from "@/routes/auth";
import { authMiddleware } from "@/middleware/auth";
```
import { auth } from "@/lib/auth";
import { authRoutes } from "@/routes/auth";
import { authMiddleware } from "@/middleware/auth";

// ❌ AVOID - Don't use relative paths with extensions
import { auth } from "./lib/auth.js";
import { authRoutes } from "./routes/auth.js";
```

### TypeScript

- Enable `strict: true` - no `any` types allowed
- Always specify return types for exported functions
- Use `type` imports: `import type { Foo } from "..."`
- Prefer interfaces for object shapes, types for unions
- Use `noUncheckedIndexedAccess: true` - handle potentially undefined values

### Naming Conventions

- Files: kebab-case (e.g., `auth-client.ts`)
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE for true constants
- Database tables: snake_case (enforced by Drizzle schema)
- Types/Interfaces: PascalCase
- Plugin instances: camelCase (e.g., `authRoutes`, `jwtMiddleware`)

### Error Handling

- Always use try/catch for async operations
- Log errors with context using `console.error()` before throwing
- Return consistent error format in routes: `{ error: string }`
- In middleware, use `set.status` to set HTTP status codes

### Better Auth Patterns

```typescript
// Auth configuration
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { ... } }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [bearer(), jwt({ ... }), admin(), twoFactor(), organization()],
});

// Auth routes
export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .all("/*", async ({ request }) => auth.handler(request));

// Protected middleware
export const authMiddleware = new Elysia()
  .use(jwtMiddleware)
  .derive({ as: "scoped" }, async ({ request, jwt, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      return { user: null, session: null, isAuthenticated: false };
    }
    return { user: session.user, session: session.session, isAuthenticated: true };
  });
```

### Email Service

- Use Resend for production emails
- Log to console in development (`NODE_ENV !== "production"`)
- Always wrap `resend.emails.send()` in try/catch
- Export typed parameters for each email function

### Environment Variables

- Access via `process.env.VAR_NAME`
- Provide sensible defaults for development (e.g., `|| "http://localhost:3000"`)
- Required production vars should use `!` assertion after checking
- Never commit `.env` files or log secrets

### Security

- Use secure cookies in production (`useSecureCookies: true`)
- Implement rate limiting for auth endpoints
- Validate CORS origins explicitly
- Store secrets in environment variables only
- Use JWT with appropriate expiration times

### Database

- Use Drizzle ORM with PostgreSQL via `@backend/db` workspace package
- Reference schema tables from `@backend/db` package
- Use transactions for multi-table operations
- Never store plain text passwords (Better Auth handles hashing)

### Testing

- Use Bun's built-in test runner: `bun test`
- Run single test: `bun test path/to/test.ts`
- Mock external APIs (Resend) in tests
- Test both authenticated and unauthenticated scenarios

### Git Workflow

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Run `bun run lint && bun run typecheck` before committing
- One logical change per commit
