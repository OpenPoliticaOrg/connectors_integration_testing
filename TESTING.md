# How to Run and Test the Code

## Prerequisites

- Bun runtime installed
- PostgreSQL database (configured in `.env` files)
- Node.js 18+ (for some tools)

## Development Setup

### 1. Install Dependencies

```bash
# From project root
bun install

# Or install for specific package
cd backend/auth && bun install
cd backend/connectors && bun install
cd backend/db && bun install
```

### 2. Configure Environment Variables

Create `.env` files for each service:

**`backend/db/.env`:**
```env
DATABASE_URL=postgresql://postgres:your_password@host:port/database
```

**`backend/auth/.env`:**
```env
BETTER_AUTH_SECRET=your_32_char_secret
BETTER_AUTH_URL=http://localhost:5001
DATABASE_URL=postgresql://postgres:your_password@host:port/database
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=your_jwt_secret
```

**`backend/connectors/.env`:**
```env
DATABASE_URL=postgresql://postgres:your_password@host:port/database
CORS_ORIGINS=http://localhost:3000
AUTH_JWKS_URL=http://localhost:5001/.well-known/jwks.json
ENCRYPTION_KEY=your_32_char_encryption_key
```

### 3. Run Database Migrations

```bash
cd backend/db
bun run db:generate
bun run db:migrate
```

## Running the Services

### Run All Services (Turborepo)

```bash
turbo run dev
```

### Run Individual Services

**Auth Service (port 5001):**
```bash
cd backend/auth
bun run dev
```

**Connectors Service (port 5002):**
```bash
cd backend/connectors
bun run dev
```

## Testing the API

### Sign Up (Email)

```bash
curl -i -c cookies.txt -X POST http://localhost:5001/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"your@email.com","password":"Password@123"}'
```

### Sign In (Email)

```bash
curl -i -c cookies.txt -X POST http://localhost:5001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"Password@123"}'
```

### Get Current Session

```bash
curl -i -b cookies.txt http://localhost:5001/api/auth/get-session
```

### Sign Out

```bash
curl -i -X POST http://localhost:5001/api/auth/sign-out -b cookies.txt
```

## Testing Protected Routes

### Test Auth Protected Route

```bash
curl -i -b cookies.txt http://localhost:5001/api/me
```

### Test Connectors Protected Route

```bash
curl -i -b cookies.txt http://localhost:5002/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello"}'
```

## Troubleshooting

### Clear Turbo Cache

```bash
turbo run build --force
rm -rf .turbo node_modules/.cache
```

### Check Types

```bash
turbo run check-types
```

### View Server Logs

Check the terminal output where `bun run dev` is running for error messages and stack traces.
