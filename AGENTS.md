# Agent Instructions - Connectors Monorepo

## Project Overview

Turborepo monorepo for AI-powered connector services. Two main backend services share a database package.

**Services:**
- `@backend/auth` (port 5001): Better Auth, JWT/JWKS issuance
- `@backend/connectors` (port 5002): AI agents, OAuth, webhooks
- `@backend/db`: Shared Drizzle ORM schema

**Key Technologies:**
- Turborepo + Bun workspaces
- Elysia framework
- Better Auth with JWT plugin
- PostgreSQL + Drizzle ORM

## Critical Rules

### Turborepo Tasks

**ALWAYS add scripts to package.json, NEVER to root tasks.**

```bash
# WRONG - root task that bypasses turbo
"build": "cd backend/auth && bun run build"

# CORRECT - script in each package.json
"build": "bun run tsc"
```

**ALWAYS use `turbo run` in code:**
```bash
# WRONG
"build": "turbo build"

# CORRECT
"build": "turbo run build"
```

### Dependency Management

**Adding workspace dependencies:**
```bash
cd backend/auth
bun add @backend/db
```

**Adding external dependencies:**
```bash
cd backend/auth
bun add elysia
```

### Cross-Service Auth Pattern

- Auth service: Better Auth with JWT plugin + JWKS endpoint
- Connectors service: Validates JWTs using JWKS from auth service
- NO direct HTTP calls between services
- Services only share database via `@backend/db`

## Common Tasks

### Schema Changes

1. Modify `backend/db/src/schema.ts`
2. Generate migration: `cd backend/db && bun run db:generate`
3. Apply migration: `cd backend/db && bun run db:migrate`

### Development

```bash
# Run all services
turbo run dev

# Run specific service
cd backend/auth && bun run dev
```

### Build

```bash
# Build all packages
turbo run build

# Build only changed + dependents
turbo run build --affected
```

## Code Standards

### Import Order
1. External libraries
2. Workspace packages (`@backend/*`, `@repo/*`)
3. Local modules (`@/*`)

### Path Aliases
- `@/` → `./src/*` (local)
- `@backend/*` → other backend packages
- `@repo/*` → shared packages

### TypeScript
- Strict mode enabled
- No `any` types
- Enable `noUncheckedIndexedAccess`

## Environment Variables

### Auth Service (`backend/auth/.env`)
```
BETTER_AUTH_SECRET=<32+ chars>
BETTER_AUTH_URL=http://localhost:5001
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=<different from auth secret>
GITHUB_CLIENT_ID=<id>
GITHUB_CLIENT_SECRET=<secret>
RESEND_API_KEY=<key>
```

### Connectors Service (`backend/connectors/.env`)
```
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:3000
AUTH_JWKS_URL=http://localhost:5001/.well-known/jwks.json
ENCRYPTION_KEY=<32-char-key>
LINEAR_CLIENT_ID=<id>
LINEAR_CLIENT_SECRET=<secret>
ANTHROPIC_API_KEY=<key>
```

### Database Package (`backend/db/.env`)
```
DATABASE_URL=postgresql://...
```

## Package-Specific Instructions

### backend/auth
See `backend/auth/AGENTS.md` for:
- Better Auth configuration
- JWT/JWKS setup
- OAuth provider setup
- Email configuration
- Rate limiting

### backend/connectors
See `backend/connectors/AGENTS.md` for:
- JWKS JWT validation
- OAuth flows with PKCE
- Webhook security
- MCP client patterns
- Token encryption

### backend/db
See `backend/db/AGENTS.md` for:
- Drizzle schema patterns
- Better Auth table requirements
- Migration workflow
- Index guidelines

## Troubleshooting

### Cache Issues
```bash
turbo run build --force
rm -rf .turbo node_modules/.cache
```

### Type Errors
```bash
turbo run check-types
```

### Database Issues
- Verify DATABASE_URL format
- Check PostgreSQL is running
- Ensure SSL config for production

## Security Checklist

- [ ] BETTER_AUTH_SECRET is 32+ characters
- [ ] JWT_SECRET differs from BETTER_AUTH_SECRET
- [ ] useSecureCookies enabled in production
- [ ] CORS origins explicitly configured
- [ ] OAuth tokens encrypted before storage
- [ ] Webhook signatures verified
- [ ] Rate limiting on auth endpoints
- [ ] No secrets in repository

## Resources

- [Turborepo Docs](https://turbo.build/repo/docs)
- [Elysia Docs](https://elysiajs.com/)
- [Better Auth Docs](https://better-auth.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
