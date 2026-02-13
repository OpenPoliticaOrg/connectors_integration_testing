# Changes Made

## Fix: Better Auth Missing `twoFactorEnabled` Field

### Problem
When attempting to sign up a new user via the Better Auth API, the following error occurred:

: The field "```
BetterAuthErrortwoFactorEnabled" does not exist in the "user" Drizzle schema.
```

### Root Cause
The database schema in `backend/db/src/schema.ts` was missing the `twoFactorEnabled` field that Better Auth requires for the users table.

### Solution

1. **Updated Schema** (`backend/db/src/schema.ts`):
   - Added `twoFactorEnabled` field to the users table:
   ```typescript
   twoFactorEnabled: boolean("two_factor_enabled").default(false),
   ```

2. **Database Migration**:
   - Generated migration: `bun run db:generate` (in `backend/db`)
   - Manually applied the column addition since tables already existed:
   ```sql
   ALTER TABLE users ADD COLUMN two_factor_enabled boolean DEFAULT false;
   ```

### Files Changed
- `backend/db/src/schema.ts` - Added `twoFactorEnabled` field to users table
- `backend/db/drizzle/0000_quick_trish_tilby.sql` - New migration file generated
