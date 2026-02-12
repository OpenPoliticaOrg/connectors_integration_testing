# Connectors Monorepo - Getting Started Guide

Welcome! This guide will help you understand this project, even if you're new to the technologies we use.

## What is this Project?

This is a system that lets users connect their tools (like GitHub, Slack, Linear) to an AI assistant. Think of it like a bridge that allows an AI to:
- Read your GitHub issues and pull requests
- Respond to Slack messages
- Create Linear tickets
- And more!

## The Big Picture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   User      │────▶│   Frontend App   │────▶│   Auth Service   │
│             │     │   (Port 3000)    │     │   (Port 5001)    │
└─────────────┘     └──────────────────┘     └──────────────────┘
                             │                          │
                             │                          │
                             ▼                          ▼
                      ┌──────────────────┐     ┌──────────────────┐
                      │Connectors Service│     │   PostgreSQL     │
                      │   (Port 5002)    │     │    Database      │
                      └──────────────────┘     └──────────────────┘
```

### Services Explained

#### 1. Auth Service (Port 5001) 🔐
**What it does:** Handles all user login and security

Think of it like a bouncer at a club:
- Checks if you have a valid ID (JWT token)
- Makes sure you're who you say you are
- Keeps track of your session while you're "inside"

**Key features:**
- User registration and login (email/password)
- Login with Google or GitHub (OAuth)
- Two-factor authentication (2FA) for extra security
- Teams/organizations support
- Issues JWT tokens (like digital ID cards)

#### 2. Connectors Service (Port 5002) 🔌
**What it does:** Manages connections to external tools and runs AI agents

Think of it like a universal remote control:
- Connects to GitHub, Slack, Linear, etc.
- Listens for events (new messages, issues created)
- Runs AI agents that can use these tools

**Key features:**
- OAuth connections to external services
- Webhook receivers (gets notified when things happen)
- AI agent orchestration
- MCP (Model Context Protocol) clients

#### 3. Database Package 📦
**What it does:** Stores all the data

Think of it like a filing cabinet:
- User accounts and sessions
- OAuth tokens (encrypted!)
- GitHub installations, Slack connections
- Events from external services
- AI agent run history

## How Everything Works Together

### Example: User Connects GitHub

```
1. User clicks "Connect GitHub" on frontend
                    │
                    ▼
2. Frontend asks Connectors Service for GitHub URL
                    │
                    ▼
3. User gets redirected to GitHub to authorize
                    │
                    ▼
4. GitHub sends user back with a code
                    │
                    ▼
5. Connectors Service exchanges code for access token
                    │
                    ▼
6. Token is encrypted and saved to database
                    │
                    ▼
7. User is now connected! 🎉
```

### Example: AI Agent Uses GitHub

```
1. User asks AI: "What are my open pull requests?"
                    │
                    ▼
2. Request goes to Connectors Service
                    │
                    ▼
3. JWT token is validated (who is this user?)
                    │
                    ▼
4. Service finds user's GitHub connection
                    │
                    ▼
5. Decrypts the stored token
                    │
                    ▼
6. Connects to GitHub MCP server
                    │
                    ▼
7. AI uses GitHub tools to get PRs
                    │
                    ▼
8. Results sent back to user
```

## Project Structure

```
connectors/
├── backend/
│   ├── auth/               # Login, security, user management
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   └── auth.ts        # Better Auth configuration
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts        # JWT validation middleware
│   │   │   ├── routes/
│   │   │   │   └── auth.ts        # Auth API routes
│   │   │   └── index.ts           # Server setup
│   │   └── .env                   # Environment variables
│   │
│   ├── connectors/         # AI agents, OAuth, webhooks
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── encryption.ts   # Token encryption
│   │   │   │   ├── pkce.ts        # OAuth security
│   │   │   │   └── token-refresh.ts
│   │   │   ├── middleware/
│   │   │   │   └── jwt-auth.ts    # JWKS validation
│   │   │   ├── mcp/
│   │   │   │   ├── client.ts      # MCP client manager
│   │   │   │   ├── github.ts      # GitHub MCP
│   │   │   │   └── linear.ts      # Linear MCP
│   │   │   ├── routes/
│   │   │   │   ├── oauth.ts       # OAuth flows
│   │   │   │   ├── agent.ts       # AI agent endpoints
│   │   │   │   ├── slack-events.ts
│   │   │   │   └── linear-events.ts
│   │   │   └── main.ts            # Server setup
│   │   └── .env
│   │
│   └── db/                 # Database schema
│       ├── src/
│       │   ├── schema.ts          # All table definitions
│       │   └── index.ts           # Database connection
│       └── drizzle/               # Migration files
│
├── packages/               # Shared code
│   ├── typescript-config/  # Shared TypeScript settings
│   └── ui/                 # Shared UI components
│
├── package.json            # Root package (Turborepo)
├── turbo.json             # Turborepo task configuration
└── README.md              # This file!
```

## Key Concepts Explained

### What is a Monorepo?

A monorepo is like a big folder containing multiple related projects. Instead of having separate git repos for each service, we keep them together because:
- They share code (like the database package)
- Changes across services are easier to track
- We can run all services at once

### What is Turborepo?

Turborepo is a tool that helps manage monorepos. Think of it like a smart task runner:
- Runs commands across all packages at once
- Only rebuilds what changed (saves time!)
- Manages dependencies between packages

**Example:** If you change the database schema, Turborepo knows to restart both auth and connectors services.

### What is Better Auth?

Better Auth is a library that handles all the complicated login stuff:
- Password hashing (super secure!)
- Session management
- Email verification
- OAuth with Google/GitHub
- Two-factor authentication

We don't have to write this ourselves - Better Auth does it for us!

### What is a JWT Token?

JWT (JSON Web Token) is like a digital ID card:
- Contains user information (ID, email)
- Signed by the server (can't be faked)
- Has an expiration time (for security)
- Sent with every request to prove who you are

**Example JWT payload:**
```json
{
  "sub": "user_123",
  "email": "user@example.com",
  "iat": 1700000000,
  "exp": 1700003600
}
```

### What is JWKS?

JWKS (JSON Web Key Set) is how services share the "keys" to verify JWTs:
- Auth service creates JWTs and publishes JWKS
- Connectors service downloads JWKS to verify tokens
- No need to share secrets between services!

### What is OAuth?

OAuth is a way to let users log in with other accounts (like Google/GitHub):
1. You say "I want to connect GitHub"
2. We redirect you to GitHub
3. GitHub asks "Is it okay to share your info?"
4. You say yes
5. GitHub gives us a token
6. We can use that token to do things on your behalf

### What is PKCE?

PKCE (Proof Key for Code Exchange) is extra security for OAuth:
- We generate a secret code before redirecting to GitHub
- GitHub gives us back a different code
- We prove we have the original secret to exchange for the token
- This prevents attackers from stealing tokens!

### What is MCP?

MCP (Model Context Protocol) is a way for AI to use tools:
- Defines what tools are available (like "create GitHub issue")
- AI can discover and use these tools
- Standard protocol works with any MCP server

Think of it like a USB port for AI - any tool that supports MCP can plug in!

### What is a Webhook?

A webhook is a notification sent from one service to another:
- Slack sends us a webhook when someone posts a message
- Linear sends us a webhook when an issue is created
- We store these events and can react to them

## Getting Started (Step by Step)

### Prerequisites

You need these installed:
- **Bun** (JavaScript runtime) - [Install here](https://bun.sh)
- **PostgreSQL** (Database) - [Install here](https://www.postgresql.org/download/)

### 1. Clone and Install

```bash
# Clone the repository
git clone <repo-url>
cd connectors

# Install dependencies for all packages
bun install
```

### 2. Set Up the Database

```bash
# Create a PostgreSQL database
createdb connectors

# Or use your database tool of choice
# Remember the connection string!
```

### 3. Configure Environment Variables

You'll need to create `.env` files. Copy the examples:

**backend/db/.env:**
```env
DATABASE_URL=postgresql://username:password@localhost:5432/connectors
```

**backend/auth/.env:**
```env
# Database (same as above)
DATABASE_URL=postgresql://username:password@localhost:5432/connectors

# Better Auth (generate a random secret)
BETTER_AUTH_SECRET=your-super-secret-key-here-at-least-32-chars
BETTER_AUTH_URL=http://localhost:5001

# CORS (what frontend can connect)
CORS_ORIGINS=http://localhost:3000,http://localhost:5002

# JWT Secret (different from above!)
JWT_SECRET=another-super-secret-key

# OAuth (optional - for login with GitHub/Google)
GITHUB_CLIENT_ID=your-github-app-id
GITHUB_CLIENT_SECRET=your-github-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret

# Email (optional - for verification emails)
RESEND_API_KEY=your-resend-key
FROM_EMAIL=noreply@yourdomain.com

# Server
PORT=5001
```

**backend/connectors/.env:**
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/connectors

# JWT Validation (points to auth service)
AUTH_JWKS_URL=http://localhost:5001/.well-known/jwks.json
AUTH_ISSUER=http://localhost:5001
AUTH_AUDIENCE=http://localhost:5001

# CORS
CORS_ORIGINS=http://localhost:3000

# Encryption (32 characters, any random string)
ENCRYPTION_KEY=your-32-character-encryption-key-here

# OAuth (for connecting external services)
LINEAR_CLIENT_ID=your-linear-client-id
LINEAR_CLIENT_SECRET=your-linear-secret
LINEAR_REDIRECT_URI=http://localhost:5002/oauth/linear/callback

# GitHub App
GITHUB_APP_NAME=your-github-app-name

# Slack
SLACK_SIGNING_SECRET=your-slack-signing-secret

# Anthropic AI
ANTHROPIC_API_KEY=your-anthropic-api-key

# Server
PORT=5002
```

### 4. Set Up the Database Schema

```bash
cd backend/db

# Push schema to database (creates tables)
bun run db:push

# Or generate and run migrations (production style)
bun run db:generate
bun run db:migrate
```

### 5. Start the Services

**Option A: Run everything at once (recommended)**
```bash
# From root directory
turbo run dev
```

**Option B: Run services separately (in different terminals)**
```bash
# Terminal 1: Auth service
cd backend/auth
bun run dev

# Terminal 2: Connectors service
cd backend/connectors
bun run dev
```

### 6. Test Everything

```bash
# Auth service should be running
curl http://localhost:5001/health
# Expected: {"status":"healthy",...}

# Connectors service should be running
curl http://localhost:5002/health
# Expected: {"status":"ok",...}

# JWKS endpoint should work
curl http://localhost:5001/.well-known/jwks.json
# Expected: JSON with public keys
```

## Common Development Tasks

### Adding a New OAuth Provider

1. **Create OAuth app** at provider's website (e.g., GitHub Apps, Linear OAuth)
2. **Add credentials to `.env`** in connectors service
3. **Add routes** in `backend/connectors/src/routes/oauth.ts`
4. **Add table** in `backend/db/src/schema.ts` if needed
5. **Generate migration** and apply it
6. **Test** the flow end-to-end

### Adding a New Database Table

1. **Define table** in `backend/db/src/schema.ts`
2. **Add indexes** for performance
3. **Export types**
4. **Generate migration:** `cd backend/db && bun run db:generate`
5. **Apply migration:** `bun run db:migrate`
6. **Use in services** via `import { schema } from "@backend/db"`

### Adding a New API Endpoint

1. **Choose the right service** (auth vs connectors)
2. **Add route** in appropriate routes file
3. **Apply middleware** if authentication needed
4. **Add validation** using Elysia's TypeBox
5. **Test** with curl or API client

### Troubleshooting

**"Cannot find module" errors:**
```bash
# Reinstall dependencies
bun install

# Or clear cache
rm -rf node_modules
bun install
```

**Database connection errors:**
- Check DATABASE_URL format
- Ensure PostgreSQL is running: `pg_isready`
- Verify user has permissions

**JWT validation fails:**
- Check AUTH_JWKS_URL points to auth service
- Ensure auth service is running
- Verify JWT not expired

**CORS errors in frontend:**
- Add your frontend URL to CORS_ORIGINS in .env
- Restart the service

**OAuth callback fails:**
- Check redirect URI matches exactly in OAuth app settings
- Verify PKCE code is being stored/retrieved

## Project Architecture Deep Dive

### Why Two Services?

**Separation of concerns:**
- Auth service focuses ONLY on authentication
- Connectors service focuses on integrations and AI
- Can scale and deploy independently

**Security:**
- Auth service has the most sensitive code
- Connectors service doesn't need auth secrets
- If connectors is compromised, auth is still safe

### How Do Services Communicate?

They DON'T make HTTP calls to each other! Instead:

1. **Shared Database** - Both services read/write to same DB
2. **JWT Tokens** - Auth service creates them, connectors validates them
3. **JWKS** - Connectors downloads public keys from auth service

This is called "stateless" architecture - services don't need to know about each other!

### Why Encrypt Tokens?

OAuth tokens are like passwords to external services:
- If database is breached, encrypted tokens are useless
- We use AES-256-GCM encryption (very secure)
- Encryption key is stored separately (in .env, not database)

### What Happens During an AI Run?

```
User sends: "Create a GitHub issue about the bug"

1. Request hits connectors service
2. JWT is validated (who is this user?)
3. Service finds user's:
   - GitHub connection (encrypted token)
   - Enabled tools
4. Decrypts GitHub token
5. Connects to GitHub MCP server
6. AI decides to use "create_issue" tool
7. MCP server creates the issue
8. Result returned to user
```

## Technologies Used

- **Bun** - Fast JavaScript runtime
- **Elysia** - Web framework (like Express but faster)
- **Better Auth** - Authentication library
- **Drizzle ORM** - Database toolkit
- **PostgreSQL** - Relational database
- **Turborepo** - Monorepo task runner
- **TypeScript** - Typed JavaScript
- **jose** - JWT library
- **Anthropic SDK** - AI integration

## Next Steps

1. **Explore the code** - Start with `backend/auth/src/index.ts`
2. **Try the APIs** - Use tools like Postman or curl
3. **Add a feature** - Maybe a new OAuth provider?
4. **Read the docs** - Links in AGENTS.md files

## Getting Help

- Check the AGENTS.md files in each package for detailed patterns
- Look at existing code for examples
- Read the official documentation for each technology
- Ask questions in team chat!

## Glossary

**API** - Application Programming Interface (how software talks to each other)
**Endpoint** - A specific URL that does something (like /login)
**Middleware** - Code that runs before your route handler (like auth checks)
**Migration** - A script that changes the database structure
**OAuth** - A way to login with other accounts (Login with Google)
**ORM** - Object-Relational Mapping (makes database easier to use)
**Schema** - Definition of what data looks like in the database
**Token** - A string that proves who you are (like a digital ticket)
**Webhook** - A notification sent from one service to another

---

**Happy coding! 🚀**

Remember: Every expert was once a beginner. Don't be afraid to ask questions!
