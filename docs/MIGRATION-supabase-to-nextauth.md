# Supabase → NextAuth migration (mirrors Stickies)

Diagrams no longer depends on Supabase. Auth is now **NextAuth v5 (Auth.js)** with
the Postgres adapter and database sessions, gated to a single owner email — the
same model as the Stickies app. The diagram data store was already plain Postgres
(`DATABASE_URL`); only the auth layer changed.

## What changed
- **Removed:** `@supabase/ssr`, `@supabase/supabase-js`, `lib/supabase/*`,
  `app/auth/callback`, `app/auth/update-password`, the Supabase middleware session
  refresh, and the Supabase **Realtime** live "AI diagram created" toast.
- **Added:** `auth.ts` (Google provider + `@auth/pg-adapter` + db sessions + owner
  gate + legacy-id passthrough), `app/api/auth/[...nextauth]/route.ts`,
  `app/sign-in/page.tsx`, `lib/auth-owner.ts` (`authorizeOwner` / `resolveOwnerId`
  / `ownerId`), `app/api/auth/me` (owner check for the client), and the NextAuth
  DB migration.
- **Auth gate:** API routes call `authorizeOwner(req)` → local/LAN bypass, OR a
  `Bearer <AI_API_SECRET>` header (scripts/AI agents), OR a NextAuth session whose
  email equals the owner. Diagram ownership uses the legacy UUID via `OWNER_USER_ID`.

## Production cutover checklist
1. **DB migration** — apply `supabase/migrations/20260524000000_nextauth.sql` to the
   Postgres database (creates `users`, `accounts`, `sessions`, `verification_token`).
   It is `CREATE TABLE IF NOT EXISTS` only — no destructive `ALTER`.
2. **Env vars** (see `.env.local.example`):
   - `AUTH_SECRET` — `openssl rand -base64 32` (NextAuth v5 reads it automatically)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `OWNER_EMAIL` (or legacy `ALLOWED_EMAIL`) — the single allowed login
   - `OWNER_USER_ID` — the **existing** owner UUID so saved diagrams still resolve.
     Find it once: `SELECT DISTINCT user_id FROM diagrams;`
   - Behind a proxy, also set `AUTH_TRUST_HOST=true`.
3. **Google OAuth console** — add the redirect URI
   `https://YOUR_DOMAIN/api/auth/callback/google` (and
   `http://localhost:3002/api/auth/callback/google` for local).
4. Remove the old Supabase env vars (`NEXT_PUBLIC_SUPABASE_*`,
   `SUPABASE_SERVICE_ROLE_KEY`) once verified.

## Local development
- The `isLocal` bypass means localhost needs no Google login. To see the gallery
  and save locally, set `OWNER_USER_ID` in `.env.local` to your owner UUID; without
  it, `/api/diagrams` returns 401 (authorized, but no owner row to query).

## Dropped feature
- The live "AI diagram created" realtime toast used Supabase Realtime and was
  removed. It can be restored with Pusher (as Stickies does) if desired.
