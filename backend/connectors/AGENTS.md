# Agent Instructions - Connectors Service (@backend/connectors)

## Service Overview

AI Agent connectors service with OAuth integrations, webhooks, and MCP clients.

**Port:** 5002
**Stack:** Elysia + Anthropic SDK + jose (JWT validation)

## Key Patterns

### JWT Authentication (No Better Auth)

This service does NOT use Better Auth. It validates JWTs from the auth service via JWKS.

**JWKS validation:**
- Fetch JWKS from auth service: `/api/auth/jwks`
- Cache JWKS client indefinitely
- Validate tokens using `jose` library
- Extract user info from JWT payload

**Environment variables:**
- `AUTH_JWKS_URL` (e.g., http://localhost:5001/api/auth/jwks)
- `AUTH_ISSUER`
- `AUTH_AUDIENCE`

### OAuth Flows

**PKCE pattern (Linear):**
1. Generate PKCE pair (code_verifier, code_challenge)
2. Store code_verifier temporarily (10 min expiration)
3. Redirect to OAuth provider with PKCE parameters
4. Exchange code for token with code_verifier
5. Encrypt and store tokens
6. Link to user account

**GitHub App pattern:**
- Uses installation flow (not OAuth)
- Webhook handles install/uninstall events
- User links installation via API

### Token Security

**Required:**
- Encrypt tokens before storage (AES-256-GCM)
- Store encryption key in `ENCRYPTION_KEY` env var
- Decrypt tokens only when needed
- Implement token refresh for expiring tokens

**Webhook Security**

Webhooks don't use JWT - they use signature verification:

**Slack:** Verify `x-slack-signature` header using signing secret
**Linear:** Verify webhook signature (if provided)
**GitHub:** Verify `x-hub-signature-256` header using webhook secret

### Rate Limiting

Uses Redis for distributed rate limiting across multiple server instances:
- **API routes:** 100 requests/minute (JWT protected)
- **Webhooks:** No rate limit (signature verification is sufficient security)
- Redis connection via `REDIS_URL` environment variable
- Bun's native Redis client - no external dependencies

**Why no webhook rate limiting:**
- Slack, GitHub, Linear all cryptographically sign their webhooks
- These platforms have their own rate limits
- Active conversations shouldn't be blocked

### MCP Client Pattern

1. Connect to MCP servers based on user integrations
2. Discover available tools
3. Filter tools by user allowlist
4. Execute agent run with available tools
5. Disconnect after completion

## Development Commands

```bash
# Start with hot reload
bun run dev

# Type check
bun run typecheck

# Production
bun run start
```

## Common Tasks

### Adding OAuth Provider

1. Add client ID/secret/redirect URI to `.env`
2. Create PKCE helper functions in `src/lib/pkce.ts`
3. Add authorization URL endpoint (public)
4. Add callback handler (public)
5. Add link endpoint (JWT required)
6. Implement token refresh in `src/lib/token-refresh.ts`
7. Add table to @backend/db schema if needed

### Adding MCP Server

1. Add MCP server URL to `.env`
2. Connect client when user has related integration
3. Add tools to available tool list
4. Pass credentials securely to MCP (encrypted)

### Processing Webhooks

1. Create route with signature verification middleware
2. Parse and validate webhook payload
3. Store event in database
4. Return appropriate response
5. Process event asynchronously (not in webhook handler)

## Security Requirements

**OAuth:**
- Use PKCE for OAuth 2.1 flows
- Encrypt tokens before storage
- Implement token refresh
- Never expose tokens in logs

**Webhooks:**
- Verify signatures on all webhooks
- Return quickly (don't block)
- Store events, process asynchronously

**JWT:**
- Validate via JWKS only
- Check issuer and audience
- Handle expiration properly

**Encryption:**
- ENCRYPTION_KEY must be 32 characters
- Use AES-256-GCM
- Store keys securely (not in code)

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis (for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# JWT Validation
AUTH_JWKS_URL=http://localhost:5001/api/auth/jwks
AUTH_ISSUER=https://localhost
AUTH_AUDIENCE=https://localhost

# CORS
CORS_ORIGINS=http://localhost:3000

# Encryption
ENCRYPTION_KEY=<32-char-key>

# OAuth
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
LINEAR_REDIRECT_URI=
GITHUB_APP_NAME=

# Webhooks
SLACK_SIGNING_SECRET=
GITHUB_WEBHOOK_SECRET=

# AI
ANTHROPIC_API_KEY=

# MCP Servers
GITHUB_MCP_URL=
LINEAR_MCP_URL=

# Server
PORT=5002
```

## Route Organization

**Public routes:**
- OAuth authorization URLs
- OAuth callbacks
- Webhooks (signature verified)
- Health check

**JWT-protected routes:**
- OAuth connection linking
- Get connections
- Agent run endpoints
- Event management APIs

## Database Patterns

**Querying with relations:**
```typescript
await db.query.tableName.findFirst({
  where: eq(tableName.column, value)
})
```

**Insert with returning:**
```typescript
const [record] = await db.insert(table).values({...}).returning()
```

**Update with conditions:**
```typescript
await db.update(table).set({...}).where(eq(table.id, id))
```

## Integration with Auth Service

- No direct HTTP calls to auth service
- JWT validation via JWKS endpoint
- User identity from JWT claims
- User IDs must match auth service

## Troubleshooting

**JWT validation fails:**
- Check AUTH_JWKS_URL is accessible
- Verify issuer/audience match
- Check JWT not expired

**OAuth callback fails:**
- Verify PKCE code_verifier stored correctly
- Check redirect URI matches exactly
- Ensure state parameter validated

**Token encryption fails:**
- Verify ENCRYPTION_KEY is 32 characters
- Check key doesn't contain special chars that break env

**Webhook signature fails:**
- Verify signing secret correct
- Check request body not modified
- Ensure timestamp not too old

## Resources

- [Elysia Docs](https://elysiajs.com/)
- [Jose Library](https://github.com/panva/jose)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Anthropic API](https://docs.anthropic.com/)
