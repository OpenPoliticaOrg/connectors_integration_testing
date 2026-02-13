# Connectors

AI-powered tool integration platform. Connect GitHub, Slack, Linear to an AI assistant.

## Quick Start

```bash
# Install dependencies
bun install

# Start all services (HTTPS enabled locally)
make dev

# Open https://localhost in your browser
# Accept the self-signed certificate warning
```

**What you get:**
- PostgreSQL at `localhost:5432`
- Redis at `localhost:6379`
- Auth API at `https://localhost/api/auth`
- Connectors API at `https://localhost/oauth`, `/agent`, `/slack`, `/linear`
- Traefik dashboard at `http://localhost:8080`

## Architecture

```
                    ┌─────────────────────────┐
                    │      Traefik (HTTPS)    │
                    │   Let's Encrypt / SSL   │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
    ┌───────────────┐                     ┌───────────────┐
    │  Auth Service │                     │  Connectors   │
    │   Port: 5001  │                     │   Port: 5002  │
    │               │                     │               │
    │ /api/auth/*   │                     │ /oauth/*      │
    │ /.well-known  │                     │ /agent/*      │
    └───────┬───────┘                     │ /slack/*      │
            │                             │ /linear/*     │
            │                             └───────┬───────┘
            │                                     │
            └──────────────┬──────────────────────┘
                           ▼
            ┌──────────────────────────┐
            │   PostgreSQL    Redis    │
            │   Port: 5432    Port:6379│
            └──────────────────────────┘
```

## Why HTTPS in Development?

**OAuth webhooks require HTTPS.** Slack, GitHub, and Linear all send webhooks over HTTPS only.

Without HTTPS locally:
- Webhooks fail silently
- OAuth callbacks don't work
- Production issues you never catch in dev

With HTTPS locally:
- Everything works exactly like production
- Test webhooks, OAuth flows end-to-end
- No surprises when deploying

## Commands

```bash
# Development
make dev              # Start all services with HTTPS
make dev-logs         # View all logs
make dev-down         # Stop services
make migrate          # Run database migrations

# Production
make prod             # Deploy to production
make prod-logs        # View production logs
make prod-down        # Stop production

# Local development (faster iteration)
make local-db         # Start only PostgreSQL + Redis
cd backend/auth && bun run dev      # Terminal 1
cd backend/connectors && bun run dev # Terminal 2
```

## Environment Setup

```bash
# Copy the template
cp .env.example .env

# Required values:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/connectors_dev
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=min-32-characters-secret
JWT_SECRET=different-secret
ENCRYPTION_KEY=exactly-32-characters!!!

# Optional (for OAuth integrations)
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
GITHUB_APP_NAME=
SLACK_SIGNING_SECRET=
ANTHROPIC_API_KEY=
```

## OAuth Redirect URIs

Configure these in your OAuth provider dashboards:

| Provider | Development | Production |
|----------|-------------|------------|
| Linear | `https://localhost/oauth/linear/callback` | `https://your-domain.com/oauth/linear/callback` |
| GitHub | `https://localhost/api/auth/callback/github` | `https://your-domain.com/api/auth/callback/github` |
| Slack | `https://localhost/slack/events` | `https://your-domain.com/slack/events` |

## Production Deployment

```bash
# 1. Configure environment
cp .env.prod.example .env.prod
nano .env.prod  # Fill in your values

# 2. Deploy
make prod

# 3. Run migrations
make migrate-prod
```

Required environment variables:

| Variable | How to generate |
|----------|-----------------|
| `DOMAIN` | Your domain (e.g., `dev.fairquanta.com`) |
| `ACME_EMAIL` | Email for Let's Encrypt |
| `DB_PASSWORD` | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | `openssl rand -base64 32` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | 32 random characters |

## Project Structure

```
backend/
├── auth/                 # Authentication service
│   ├── src/
│   │   ├── lib/auth.ts   # Better Auth config
│   │   └── index.ts
│   └── Dockerfile
│
├── connectors/           # Integration service
│   ├── src/
│   │   ├── routes/
│   │   │   ├── oauth.ts      # OAuth flows
│   │   │   ├── agent.ts      # AI agent
│   │   │   └── slack-events.ts
│   │   ├── middleware/
│   │   │   ├── jwt-auth.ts   # JWKS validation
│   │   │   └── rate-limit.ts # Redis rate limiting
│   │   └── lib/
│   │       ├── encryption.ts # AES-256-GCM
│   │       └── pkce.ts       # OAuth PKCE
│   └── Dockerfile
│
└── db/                   # Shared database package
    ├── src/schema.ts     # Drizzle schema
    └── drizzle/          # Migrations
```

## API Endpoints

### Auth Service

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/jwks.json` | JWT public keys |
| `POST /api/auth/sign-up/email` | Register user |
| `POST /api/auth/sign-in/email` | Login |
| `POST /api/auth/sign-in/social` | OAuth login |
| `GET /api/auth/session` | Current session |

### Connectors Service

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /oauth/linear` | No | Get Linear OAuth URL |
| `GET /oauth/linear/callback` | No | Linear callback |
| `POST /oauth/linear/link` | JWT | Link to user |
| `POST /slack/events` | Signature | Slack webhook |
| `POST /linear/events` | Signature | Linear webhook |
| `POST /agent/run` | JWT | Execute AI agent |
| `GET /oauth/connections` | JWT | List connections |

## Troubleshooting

### Certificate Warning

When opening `https://localhost`, your browser shows a warning. This is normal - it's a self-signed certificate for development. Click "Advanced" → "Proceed anyway".

### OAuth Not Working

1. Check redirect URI matches exactly (including `https://`)
2. Verify credentials in `.env`
3. Check logs: `make logs-connectors`

### Database Issues

```bash
# Reset database
cd backend/db
bun run db:push

# Or run migrations
bun run db:migrate
```

### View Logs

```bash
make dev-logs           # All services
docker logs <container> # Specific service
```

## Tech Stack

- **Runtime:** Bun
- **Framework:** Elysia
- **Auth:** Better Auth + JWT
- **Database:** PostgreSQL + Drizzle ORM
- **Cache:** Redis
- **Proxy:** Traefik
- **AI:** Anthropic + MCP
