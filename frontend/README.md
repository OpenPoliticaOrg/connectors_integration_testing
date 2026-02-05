# Frontend Setup

## Quick Start

```bash
# Install dependencies
npm install

# Run with local backend (default)
npm run dev

# Run with ngrok (backend exposed to internet)
# 1. Copy env file
cp .env.example .env

# 2. Edit .env and set your ngrok URL:
# VITE_API_BASE_URL=https://your-ngrok-url.ngrok-free.app/api/v1

# 3. Run dev server
npm run dev
```

## Environment Variables

Create a `.env` file in this directory:

```env
# For local development (uses Vite proxy)
VITE_API_BASE_URL=/api/v1

# For ngrok development
VITE_API_BASE_URL=https://xxxx.ngrok-free.app/api/v1

# For production
VITE_API_BASE_URL=https://your-domain.com/api/v1
```

## Using with Ngrok

When your backend is behind ngrok:

1. **Start ngrok** (in backend directory):
   ```bash
   cd ../backend
   docker-compose --profile ngrok up
   ```

2. **Get your public URL**:
   - Open http://localhost:4040
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

3. **Configure frontend**:
   ```bash
   # In frontend directory
   echo "VITE_API_BASE_URL=https://abc123.ngrok-free.app/api/v1" > .env
   ```

4. **Restart frontend**:
   ```bash
   npm run dev
   ```

## API Connection Check

The frontend will log API requests to the console. If you see errors:

1. Check that `VITE_API_BASE_URL` is set correctly
2. Ensure backend is running
3. Check browser console for CORS errors
4. Verify ngrok URL hasn't changed (free tier URLs change on restart)

## Building for Production

```bash
npm run build
```

The build output goes to `dist/` directory.
