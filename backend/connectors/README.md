# @backend/connectors

AI Agent Connectors service with **independent JWT authentication** via JWKS.

## 🏗️ Architecture

This service is **completely independent** from `@backend/auth`. It validates JWTs locally using JWKS from the auth service.

```
┌─────────────┐                    ┌─────────────────┐
│   Client    │────── JWT ────────▶│  Auth Service   │
└─────────────┘                    │   (Port 3000)   │
                                   │  Issues tokens  │
                                   └────────┬────────┘
                                            │
                                   JWKS endpoint
                                   (/.well-known/jwks.json)
                                            │
                                   ┌────────▼────────┐
                                   │   Connectors    │
                                   │   (Port 3001)   │
                                   │ Validates JWTs  │
                                   │    locally!     │
                                   └─────────────────┘
```

## 🔐 Authentication Strategy

### API Routes (User-facing)

**Require JWT Bearer token in Authorization header**

```bash
GET /oauth/connections
Authorization: Bearer eyJhbGciOiJFZERTQSJ9...

# JWT validated locally using cached JWKS from auth service
```

### Webhook Routes (External services)

**Use signature verification (NO JWT)**

```bash
POST /slack/events
# Verified using Slack's x-slack-signature header
# No JWT needed - called by Slack, not users

POST /oauth/github/webhook
# Verified using GitHub's X-Hub-Signature-256
# No JWT needed - called by GitHub, not users
```

## 🛠️ Setup

### Environment Variables

```env
# Database (shared with auth service)
DATABASE_URL=postgresql://user:password@localhost:5432/auth_db

# Auth Service (for JWKS)
AUTH_JWKS_URL=http://localhost:3000/.well-known/jwks.json
AUTH_ISSUER=http://localhost:3000
AUTH_AUDIENCE=http://localhost:3000

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Webhook Secrets
SLACK_SIGNING_SECRET=your-slack-signing-secret
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret

# Service Port
PORT=3001
```

## 📁 Project Structure

```
src/
├── middleware/
│   └── jwt-auth.ts      # JWT validation using jose + JWKS
├── routes/
│   ├── oauth.ts         # GitHub/Slack OAuth (API: JWT, Webhooks: Signatures)
│   ├── agent.ts         # AI agent runs (API: JWT)
│   └── slack-events.ts  # Slack webhooks (Webhook: Signature, API: JWT)
├── mcp/
│   └── client.ts        # MCP client for tools
└── main.ts              # Elysia app entry point
```

## 🔑 How JWT Validation Works

```typescript
// middleware/jwt-auth.ts
import { createRemoteJWKSet, jwtVerify } from "jose";

// Cache JWKS indefinitely - keys don't change often
const jwks = createRemoteJWKSet(new URL("http://localhost:3000/.well-known/jwks.json"));

// Validate JWT locally - no network call to auth service!
const { payload } = await jwtVerify(token, jwks, {
  issuer: "http://localhost:3000",
  audience: "http://localhost:3000",
});

// payload.sub = user id
// payload.email = user email
```

## 📚 API Endpoints

### Public (No Auth)

- `GET /health` - Health check

### Webhooks (Signature Verified)

- `POST /slack/events` - Slack events webhook
- `POST /oauth/github/webhook` - GitHub App webhook

### API (JWT Required)

- `GET /oauth/connections` - Get user's connections
- `POST /oauth/github/link` - Link GitHub installation
- `DELETE /oauth/connections/:provider` - Disconnect provider
- `POST /agent/run` - Run AI agent
- `GET /agent/runs` - Get agent run history
- `GET /agent/tools` - Get available tools
- `GET /slack/events` - Get Slack events (user's own)
- `GET /slack/events/stats` - Get event statistics

## 🔄 Flow Examples

### User API Call

```
1. Client has JWT from auth service
2. Calls GET /oauth/connections with Authorization: Bearer <jwt>
3. Connectors validates JWT locally using cached JWKS
4. Returns user's connections
```

### Slack Webhook

```
1. Slack sends POST /slack/events
2. Connectors verifies x-slack-signature header
3. No JWT check (Slack doesn't have one!)
4. Stores event in database
```

## 🚀 Development

```bash
# Start auth service first (on port 3000)
cd backend/auth && bun run dev

# Start connectors service (on port 3001)
cd backend/connectors && bun run dev

# Both services share the same database via @backend/db
```

## ✨ Benefits

1. **True Independence** - Connectors doesn't depend on auth service being up
2. **No Network Calls** - JWT validation is local (cached JWKS)
3. **Webhooks Just Work** - No JWT complexity for external service callbacks
4. **Industry Standard** - Same pattern used by AWS, Auth0, etc.
5. **Horizontal Scaling** - Each service scales independently

---

# Complete Guide for Junior Developers

## 🎯 What This Project Does

This is a backend service that connects to **GitHub** and **Slack** to help an AI agent interact with these platforms on behalf of users.

### Simple Example:

1. User says: "List my GitHub repositories"
2. AI asks this backend to fetch repos from GitHub
3. Backend validates user's JWT (locally!)
4. Backend gets the repos and returns them to AI
5. AI summarizes and shows to user

## 🗄️ Database Tables

### Shared Database

This service shares a database with the auth service via `@backend/db`:

- **users** - User accounts (managed by auth service)
- **githubInstallations** - GitHub App installations
- **slackConnections** - Slack OAuth connections
- **slackEvents** - Slack event logs
- **tools** - Available AI tools
- **userTools** - User's enabled tools
- **agentRuns** - AI conversation history
- **toolCalls** - Detailed tool usage logs

## 🔌 API Endpoints

### GITHUB INTEGRATION

#### `GET /oauth/github` - Get GitHub install URL

Returns URL where user installs our GitHub App.

#### `POST /oauth/github/webhook` - GitHub webhook (NO JWT)

Receives notifications from GitHub when someone installs/uninstalls the app.
Uses **signature verification**, not JWT.

#### `POST /oauth/github/link` - Link to user (JWT REQUIRED)

Connects the GitHub installation to a user account.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

### SLACK INTEGRATION

#### `POST /slack/events` - Receive Slack events (NO JWT)

Main webhook endpoint. Slack sends all events here.
Uses **signature verification**, not JWT.

#### `GET /slack/events` - Get user's Slack events (JWT REQUIRED)

Returns all Slack events for the authenticated user.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

### CONNECTIONS MANAGEMENT

#### `GET /oauth/connections` - List all connections (JWT REQUIRED)

Shows which integrations the user has connected.

#### `DELETE /oauth/connections/:provider` - Disconnect (JWT REQUIRED)

Removes a connection (GitHub or Slack).

### AGENT ENDPOINTS

#### `POST /agent/run` - Run AI agent (JWT REQUIRED)

The main endpoint! User asks something, AI does it.

**Request:**

```json
{
  "prompt": "List my GitHub repositories",
  "threadId": "optional-conversation-id"
}
```

**Headers:**

```
Authorization: Bearer <jwt_token>
```

## 🔐 Security Features

### JWT Authentication (API Routes)

Every user-facing request needs a JWT token:

```
Authorization: Bearer eyJhbGciOiJFZERTQSJ9...
```

The token is validated **locally** using JWKS from the auth service. No network calls!

### Signature Verification (Webhooks)

External services (Slack, GitHub) send webhooks with signatures:

- **Slack**: `x-slack-signature` header
- **GitHub**: `X-Hub-Signature-256` header

We verify these signatures using secrets to ensure the request is legitimate.

### Why Two Different Auth Methods?

| Method        | Use Case          | Example                             |
| ------------- | ----------------- | ----------------------------------- |
| **JWT**       | User API calls    | Getting connections, running agents |
| **Signature** | External webhooks | Slack events, GitHub installations  |

JWTs are for users who logged in. Signatures are for services that can't login (like Slack).

## 🚀 How to Set Up

### Step 1: Start Auth Service

```bash
cd backend/auth
bun run dev
# Runs on port 3000
```

### Step 2: Start Connectors Service

```bash
cd backend/connectors
bun run dev
# Runs on port 3001
```

### Step 3: Configure Slack Webhooks

1. Go to https://api.slack.com/apps
2. Enable Event Subscriptions
3. Set Request URL: `https://your-domain.com/slack/events`
4. Add `SLACK_SIGNING_SECRET` to `.env`

### Step 4: Configure GitHub App

1. Create GitHub App
2. Set webhook URL: `https://your-domain.com/oauth/github/webhook`
3. Install app on your account

## 📝 Common Tasks

### How to call an API endpoint:

```bash
# 1. Get JWT from auth service first
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Response: { "token": "eyJhbGciOiJFZERTQSJ9..." }

# 2. Use token to call connectors API
curl http://localhost:3001/oauth/connections \
  -H "Authorization: Bearer eyJhbGciOiJFZERTQSJ9..."
```

### How webhooks work:

```bash
# No token needed! Slack calls this directly:
curl -X POST http://localhost:3001/slack/events \
  -H "x-slack-signature: v0=abc123..." \
  -H "x-slack-request-timestamp: 1234567890" \
  -d '{"type": "event_callback", ...}'
```

## ❓ Troubleshooting

### "Unauthorized" error

- Check that you're sending `Authorization: Bearer <token>` header
- Token might be expired - get a new one from auth service
- Make sure auth service is running (for JWKS)

### Slack events not being received

- Check ngrok URL is correct in Slack app settings
- Verify `SLACK_SIGNING_SECRET` is set
- Check server logs for signature verification errors
- Make sure you're responding within 3 seconds

### JWT validation fails

- Check `AUTH_JWKS_URL` points to correct auth service
- Verify auth service is running and accessible
- Check that JWT issuer and audience match

---

**Good luck building! 🚀**
