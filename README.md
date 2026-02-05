# Coordination Intelligence Platform

AI-powered Slack assistant that analyzes team communication patterns, identifies coordination gaps, and helps teams collaborate more effectively.

## 🎯 What This Does

- **Monitors Slack conversations** in channels where the bot is added
- **Detects coordination patterns** (questions raised, owners assigned, resolutions)
- **Identifies gaps** where questions go unanswered or work stalls
- **Provides insights** through a web dashboard
- **Privacy-first**: Only analyzes work patterns, never individual performance scores

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                 │
│                     http://localhost:3000                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                        │
│                    http://localhost:8000                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   OAuth      │  │ Conversation │  │  Analytics   │      │
│  │   Service    │  │   Memory     │  │   Engine     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Understanding│  │ Coordination │  │  Assistant   │      │
│  │    Agent     │  │    Agent     │  │    Agent     │      │
│  │   (DSPy)     │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ OAuth / Events
                              ↓
                    ┌──────────────────────┐
                    │        Slack         │
                    │   (Slack API)        │
                    └──────────────────────┘
```

## 📁 Project Structure

```
slack_mcp/
├── backend/                          # FastAPI Python backend
│   ├── app/
│   │   ├── agents/                   # AI agents (Understanding, Coordination, Assistant)
│   │   ├── api/                      # API routes (OAuth, conversations, analytics)
│   │   ├── core/                     # Core modules (config, database, security)
│   │   ├── mcp/                      # Model Context Protocol client
│   │   ├── models/                   # Database models
│   │   └── services/                 # Business logic services
│   ├── tests/                        # Test suite
│   ├── .env                          # Environment variables (create from .env.example)
│   ├── docker-compose.yml            # Docker orchestration
│   ├── Dockerfile                    # Container definition
│   └── requirements.txt              # Python dependencies
│
├── frontend/                         # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/                    # Page components (Landing, Login, Dashboard)
│   │   ├── services/                 # API client
│   │   ├── context/                  # React context (AppContext)
│   │   └── types/                    # TypeScript types
│   ├── .env                          # Frontend env vars (create from .env.example)
│   └── vite.config.ts                # Vite configuration
│
└── SETUP.md                          # Detailed setup guide
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for backend)
- **Node.js 18+** (for frontend)
- **npm or yarn**
- **Slack App** (create at https://api.slack.com/apps)
- **OpenAI API Key** (get at https://platform.openai.com/api-keys)

### 1. Clone & Setup

```bash
git clone <repo-url>
cd slack_mcp
```

### 2. Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# ============================================
# REQUIRED: Slack OAuth Credentials
# ============================================
# Get from: https://api.slack.com/apps > Your App > Basic Information
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_SIGNING_SECRET=your-signing-secret

# ============================================
# REQUIRED: AI Provider API Key
# ============================================
OPENAI_API_KEY=sk-your-openai-key

# ============================================
# OPTIONAL: Database (defaults to SQLite)
# ============================================
DATABASE_URL=sqlite:///./data/dev.db
DATABASE_TYPE=sqlite

# ============================================
# OPTIONAL: Ngrok (for HTTPS development)
# ============================================
# Get from: https://dashboard.ngrok.com/get-started/your-authtoken
NGROK_AUTHTOKEN=your-ngrok-token

# Will be auto-set when ngrok starts
PUBLIC_URL=http://localhost:8000
ALLOWED_REDIRECT_URLS=http://localhost:8000/oauth/callback
```

### 3. Configure Slack App

1. Go to https://api.slack.com/apps
2. Create New App → From scratch
3. Name it "fairquanta" (or your preferred name)
4. In **Basic Information**, copy Client ID & Secret to `.env`

**Add Bot User:**
- Go to **App Home** → Add Bot User
- Display name: `fairquanta`
- Username: `fairquanta`

**Add OAuth Scopes (Bot Token Scopes):**
- `channels:history` - Read public channel messages
- `groups:history` - Read private channel messages
- `im:history` - Read direct messages
- `channels:read` - View public channels
- `groups:read` - View private channels
- `users:read` - View workspace members
- `app_mentions:read` - Read when bot is mentioned
- `chat:write` - Send messages

**Add Redirect URLs:**
- `http://localhost:8000/oauth/callback` (for local dev)
- `https://xxxx.ngrok-free.app/oauth/callback` (when using ngrok)

### 4. Start Backend

```bash
cd backend

# Option A: With Docker (recommended)
docker compose up

# Option B: With Docker + Ngrok (for HTTPS)
docker compose --profile ngrok up

# Option C: Local Python (requires Python 3.11+)
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 6. Test the Flow

1. Open http://localhost:3000
2. Click "Get Started"
3. Click "Add to Slack"
4. Authorize the app in your Slack workspace
5. You should be redirected to the dashboard

## 🔧 Environment Variables Reference

### Backend (.env)

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `SLACK_CLIENT_ID` | ✅ Yes | OAuth Client ID | Slack App → Basic Information |
| `SLACK_CLIENT_SECRET` | ✅ Yes | OAuth Client Secret | Slack App → Basic Information |
| `SLACK_SIGNING_SECRET` | ✅ Yes | Request signing secret | Slack App → Basic Information |
| `OPENAI_API_KEY` | ✅ Yes | OpenAI API access | https://platform.openai.com/api-keys |
| `DATABASE_URL` | ❌ No | Database connection | Default: SQLite |
| `ALLOWED_REDIRECT_URLS` | ❌ No | Valid OAuth callbacks | Default: localhost only |
| `NGROK_AUTHTOKEN` | ❌ No | Ngrok authentication | https://dashboard.ngrok.com |
| `PUBLIC_URL` | ❌ No | Public-facing URL | Auto-set or manual |
| `DEBUG` | ❌ No | Debug mode | Default: false |

### Frontend (.env)

```env
# API Base URL
# For local dev: /api/v1 (uses Vite proxy)
# For ngrok: https://xxxx.ngrok-free.app/api/v1
VITE_API_BASE_URL=/api/v1

# OAuth Redirect URL
VITE_OAUTH_REDIRECT_URL=http://localhost:8000/api/oauth/callback
```

## 🐳 Docker Services

| Service | Port | Description | Profile |
|---------|------|-------------|---------|
| `app` | 8000 | FastAPI backend | default |
| `ngrok` | 4040 | Public HTTPS tunnel | ngrok |
| `db` | 5432 | PostgreSQL database | postgres |
| `redis` | 6379 | Redis cache | redis |

### Common Docker Commands

```bash
# Start all services
docker compose up

# Start with ngrok (HTTPS)
docker compose --profile ngrok up

# Start with PostgreSQL
docker compose --profile postgres up

# Rebuild after code changes
docker compose up --build

# View logs
docker compose logs -f app

# Stop everything
docker compose down
```

## 🔒 Security Considerations

### OAuth Redirect URI Validation

The backend validates all OAuth redirect URIs against an allowlist:
- Set `ALLOWED_REDIRECT_URLS` in `.env` (comma-separated)
- Example: `http://localhost:8000/oauth/callback,https://app.com/oauth/callback`
- Prevents open redirect attacks

### Scope Validation

Only these Slack scopes are used:
- `channels:history` - Read messages (where bot is added)
- `chat:write` - Post messages
- `users:read` - View workspace members
- No access to private messages or channels where bot isn't added

## 🧪 Testing

```bash
cd backend

# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_core.py -v

# Run with coverage
python -m pytest tests/ --cov=app
```

## 📦 Deployment

### Production Checklist

- [ ] Use PostgreSQL instead of SQLite
- [ ] Set `DEBUG=false`
- [ ] Use strong `SECRET_KEY` and `ENCRYPTION_KEY`
- [ ] Configure `ALLOWED_REDIRECT_URLS` with production URLs
- [ ] Add production redirect URL to Slack app
- [ ] Enable distribution in Slack app settings
- [ ] Deploy to cloud provider (Railway, Render, Fly.io, AWS)
- [ ] Set up monitoring and logging

### Deploy to Railway (Example)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd backend
railway init

# Add PostgreSQL
railway add --database postgres

# Set environment variables
railway variables set SLACK_CLIENT_ID=xxx
railway variables set SLACK_CLIENT_SECRET=xxx
# ... set other variables

# Deploy
railway up
```

## 🐛 Troubleshooting

### "Invalid redirect_uri" Error
- Check `ALLOWED_REDIRECT_URLS` in `.env`
- Add your URL to Slack app OAuth settings
- Restart Docker after changing `.env`

### "Invalid permissions requested" Error
- Remove invalid scopes from Slack app settings
- Valid scopes listed in Environment Variables section
- Restart backend after updating scopes

### "Doesn't have a bot user" Error
- Go to Slack app → App Home → Add Bot User
- Required for any app using bot scopes

### Ngrok Authentication Failed
- Check `NGROK_AUTHTOKEN` in `.env` (just the token, no extra text)
- Get token from https://dashboard.ngrok.com/get-started/your-authtoken

### 404 Errors on API Endpoints
- Backend container isn't running: `docker compose up`
- Volume mount failed: restart with `docker compose up --build`

## 📝 License

MIT License - See LICENSE file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

- Create an issue on GitHub
- Check existing issues for solutions
- Review this README and SETUP.md

---

**Built with ❤️ for better team coordination**
