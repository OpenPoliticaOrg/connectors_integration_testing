# Agent Instructions - Auth Service (@backend/auth)

## Service Overview

Central authentication service with Better Auth, JWT/JWKS, email flows, and organizations.

**Port:** 5001
**Stack:** Elysia + Better Auth + Drizzle ORM

## Key Patterns

### Better Auth Integration

The auth service uses Better Auth with the Drizzle adapter. Configuration is centralized in `src/lib/auth.ts`.

**Required environment variables:**
- `BETTER_AUTH_SECRET` (32+ chars, openssl rand -base64 32)
- `BETTER_AUTH_URL` (e.g., http://localhost:5001)
- `DATABASE_URL`
- `JWT_SECRET` (different from auth secret)

**Better Auth plugins used:**
- `bearer` - API token auth
- `jwt` - JWT with JWKS for cross-service auth
- `admin` - User management
- `twoFactor` - TOTP/OTP 2FA
- `organization` - Teams/organizations

### Elysia Patterns

**Route organization:**
- Routes in `src/routes/` as Elysia plugins
- Middleware in `src/middleware/` as Elysia plugins
- Use `.derive()` to add context to requests
- Apply middleware after public routes

**Middleware pattern:**
- Use `as: "scoped"` for middleware derivation
- Check Better Auth session via `auth.api.getSession()`
- Add JWT token to context using `@elysiajs/jwt`

### Database Tables

Better Auth requires these tables (defined in @backend/db):
- `users`, `sessions`, `accounts`, `verifications` (core)
- `organizations`, `members`, `invitations` (organization plugin)
- `twoFactors` (twoFactor plugin)

## Development Commands

```bash
# Start with hot reload
bun run dev

# Type check
bun run check-types

# Production
bun run start
```

## Common Tasks

### Adding OAuth Provider

1. Add client ID/secret to `.env`
2. Add provider config to `src/lib/auth.ts` socialProviders
3. Ensure redirect URI configured in provider dashboard
4. Test sign-in flow

### Adding Better Auth Plugin

1. Import plugin in `src/lib/auth.ts`
2. Add to plugins array
3. If plugin adds tables, regenerate DB schema
4. Re-run migrations if needed

### Email Configuration

1. Set `RESEND_API_KEY` in `.env`
2. Configure `emailAndPassword.sendResetPassword` handler
3. Configure `emailVerification.sendVerificationEmail` handler
4. Test email flows in development

## Security Requirements

**Must configure:**
- `BETTER_AUTH_SECRET` (32+ characters)
- `useSecureCookies: true` in production
- `trustedOrigins` for CORS domains
- Rate limiting on auth endpoints
- Email verification for production

**Secrets:**
- JWT_SECRET must differ from BETTER_AUTH_SECRET
- Never log secrets or tokens
- Use HTTPS in production

## Environment Variables

```env
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:5001
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
FROM_EMAIL=
PORT=5001
```

## Service Endpoints

Better Auth automatically creates:
- POST `/api/auth/sign-up/email`
- POST `/api/auth/sign-in/email`
- POST `/api/auth/sign-in/social`
- POST `/api/auth/sign-out`
- GET `/api/auth/session`
- GET `/.well-known/jwks.json` (for other services)

## Integration with Other Services

Other services validate JWTs using the JWKS endpoint:
- `AUTH_JWKS_URL=http://localhost:5001/.well-known/jwks.json`
- No direct service-to-service calls needed
- JWTs validated via `jose` library with JWKS

## Troubleshooting

**"Secret not set" error:**
- Add BETTER_AUTH_SECRET to .env

**"Invalid Origin" error:**
- Add domain to trustedOrigins in auth config

**Cookies not setting:**
- Check BETTER_AUTH_URL matches actual domain
- Enable useSecureCookies in production
- Verify HTTPS

**OAuth callback fails:**
- Verify redirect URIs match in provider dashboard exactly

## Resources

- [Better Auth Docs](https://better-auth.com/docs)
- [Better Auth Plugins](https://better-auth.com/docs/concepts/plugins)
- [Elysia Docs](https://elysiajs.com/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
