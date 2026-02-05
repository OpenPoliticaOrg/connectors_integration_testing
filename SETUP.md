# Quick Setup Guide

## Complete Setup Steps

### 1. Environment Variables

Create `backend/.env` file:

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add these required values:

```env
# Required for Slack OAuth
SLACK_CLIENT_ID=your-client-id-from-slack
SLACK_CLIENT_SECRET=your-client-secret-from-slack
SLACK_SIGNING_SECRET=your-signing-secret

# Required for AI
OPENAI_API_KEY=sk-your-openai-key

# For local development (localhost)
ALLOWED_REDIRECT_URLS=http://localhost:8000/oauth/callback

# Optional: Add ngrok URL when using it
# ALLOWED_REDIRECT_URLS=http://localhost:8000/oauth/callback,https://xxxx.ngrok-free.app/oauth/callback

# Ngrok (optional)
NGROK_AUTHTOKEN=your-ngrok-token
PUBLIC_URL=http://localhost:8000
```

### 2. Start Everything

**Option A: Local Development (Fastest)**
```bash
cd backend
./start.sh local
```

**Option B: Docker (Recommended)**
```bash
cd backend
./start.sh docker
```

**Option C: With Ngrok (Public URL)**
```bash
cd backend
./start.sh ngrok
```

### 3. Start Frontend

```bash
cd frontend
npm install  # First time only
npm run dev
```

### 4. Configure Slack App

Go to https://api.slack.com/apps and select your app:

**OAuth & Permissions:**
- Add Redirect URLs:
  - `http://localhost:8000/oauth/callback`
  - (If using ngrok) `https://your-ngrok-url.ngrok-free.app/oauth/callback`

**Basic Information:**
- Copy Client ID and Client Secret to your `.env` file

### 5. Test It

1. Open http://localhost:3000
2. Click "Get Started"
3. Click "Add to Slack"
4. Should redirect to Slack OAuth page

## Troubleshooting

**404 Error on /api/v1/oauth/install:**
- Backend isn't running or volume mount failed
- Run: `docker-compose down && docker-compose up --build`

**"Invalid redirect_uri" error:**
- Add your URL to `ALLOWED_REDIRECT_URLS` in `.env`
- Also add it in Slack app OAuth settings
- Restart docker: `docker-compose down && docker-compose up`

**"redirect_uri did not match" from Slack:**
- Your URL isn't in Slack's allowed list
- Go to Slack app → OAuth & Permissions → Add redirect URL

**Volume not syncing:**
- Make sure you're editing files in `/home/sarthak/sarthak/slack_mcp/backend/`
- Check with: `docker-compose exec app ls -la /app/app`

## Architecture

```
Frontend (localhost:3000)
    ↓ (Vite proxy)
Backend API (localhost:8000)
    ↓ (OAuth)
Slack
```

With ngrok:
```
Frontend (localhost:3000)
    ↓ (Vite proxy)
Backend API (localhost:8000)
    ↓ (ngrok tunnel)
Public URL (xxxx.ngrok-free.app)
    ↓ (OAuth)
Slack
```

## Quick Commands

```bash
# Restart everything
docker-compose down && docker-compose up --build

# View logs
docker-compose logs -f app

# Check ngrok URL
curl http://localhost:4040/api/tunnels

# Test backend
curl http://localhost:8000/health
```
