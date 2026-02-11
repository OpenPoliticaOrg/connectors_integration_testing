# Production-Ready Authentication API

A full-stack authentication system built with **Elysia**, **Better Auth**, **Drizzle ORM**, **PostgreSQL**, and **JWT**.

## 🚀 Features

- **Better Auth** - Complete authentication solution
- **Elysia** - High-performance Bun web framework
- **Drizzle ORM** - Type-safe SQL-like ORM
- **PostgreSQL** - Robust relational database
- **JWT** - JSON Web Token authentication
- **2FA** - Two-factor authentication support
- **Organizations** - Multi-tenant organization support
- **OAuth** - GitHub and Google login
- **Resend Email** - Transactional emails (verification, password reset, welcome)
- **Rate Limiting** - Built-in rate limiting
- **Swagger UI** - Auto-generated API documentation

## 📁 Project Structure

```
.
├── src/
│   ├── db/
│   │   └── schema.ts          # Drizzle database schema
│   ├── lib/
│   │   ├── auth.ts            # Better Auth configuration
│   │   ├── auth-client.ts     # Client-side auth utilities
│   │   ├── db.ts              # Database connection
│   │   └── email.ts           # Resend email service
│   ├── middleware/
│   │   └── auth.ts            # JWT & auth middleware
│   ├── routes/
│   │   └── auth.ts            # Auth route handlers
│   └── index.ts               # Main Elysia app
├── drizzle.config.ts          # Drizzle configuration
├── .env.example               # Environment variables template
└── package.json
```

## 🛠️ Setup

### 1. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Better Auth
BETTER_AUTH_SECRET=your-32-char-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/auth_db

# JWT
JWT_SECRET=your-jwt-secret-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# OAuth (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Resend Email (Get API key from https://resend.com)
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=onboarding@yourdomain.com
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE auth_db;"
```

### 3. Run Migrations

Generate and run Drizzle migrations:

```bash
# Generate migration files
bun run db:generate

# Apply migrations
bun run db:migrate

# Or use push for development
bun run db:push
```

### 4. Start the Server

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

The server will start at `http://localhost:3000` with API docs at `/swagger`.

## 📚 API Endpoints

### Public Endpoints

| Endpoint      | Method | Description           |
| ------------- | ------ | --------------------- |
| `/`           | GET    | API info              |
| `/health`     | GET    | Health check          |
| `/swagger`    | GET    | API documentation     |
| `/api/auth/*` | ALL    | Better Auth endpoints |

### Protected Endpoints (Requires Authentication)

| Endpoint         | Method | Description             |
| ---------------- | ------ | ----------------------- |
| `/api/me`        | GET    | Get current user        |
| `/api/protected` | GET    | Example protected route |

### Better Auth Endpoints

All Better Auth endpoints are available at `/api/auth/*`:

- `POST /api/auth/sign-in/email` - Email/password sign in
- `POST /api/auth/sign-up/email` - Email/password sign up
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get session
- `POST /api/auth/sign-in/social` - OAuth sign in
- And more...

## 🔐 Authentication Flow

### Email/Password Authentication

```typescript
import { authClient } from "./src/lib/auth-client";

// Sign up
const { data, error } = await authClient.signUp.email({
  email: "user@example.com",
  password: "securepassword123",
  name: "John Doe",
});

// Sign in
const { data, error } = await authClient.signIn.email({
  email: "user@example.com",
  password: "securepassword123",
});

// Sign out
await authClient.signOut();
```

### Using JWT Tokens

The server automatically issues JWT tokens for authenticated requests:

```typescript
// Access protected route with session cookie
const response = await fetch("http://localhost:3000/api/me", {
  credentials: "include", // Important for cookies
});

// Or use Bearer token
const response = await fetch("http://localhost:3000/api/me", {
  headers: {
    Authorization: `Bearer ${jwtToken}`,
  },
});
```

## 🗄️ Database Schema

The schema includes:

- **users** - User accounts
- **sessions** - Active sessions
- **accounts** - OAuth accounts
- **verifications** - Email verification tokens
- **organizations** - Multi-tenant organizations
- **members** - Organization memberships
- **invitations** - Organization invitations
- **twoFactors** - 2FA settings

## 🔧 Available Scripts

```bash
# Development
bun run dev              # Start with hot reload
bun run start            # Start production server

# Database
bun run db:generate      # Generate migration files
bun run db:migrate       # Run migrations
bun run db:push          # Push schema changes
bun run db:studio        # Open Drizzle Studio

# Auth
bun run auth:generate    # Generate Better Auth schema
```

## 🛡️ Security Features

- ✅ Secure cookie settings in production
- ✅ Rate limiting on auth endpoints
- ✅ CSRF protection
- ✅ Password hashing with bcrypt
- ✅ Session management
- ✅ Email verification (via Resend)
- ✅ Password reset (via Resend)
- ✅ Welcome emails (via Resend)
- ✅ Two-factor authentication
- ✅ Trusted origins validation

## 📖 Documentation

- [Better Auth Docs](https://better-auth.com/docs)
- [Elysia Docs](https://elysiajs.com)
- [Drizzle ORM Docs](https://orm.drizzle.team)

## 📄 License

MIT
