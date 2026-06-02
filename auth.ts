import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import pool from "@/lib/db";

// Mirrors the Stickies auth model: NextAuth v5 + Postgres adapter + database
// sessions, gated to a single owner email. No Supabase.
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? process.env.ALLOWED_EMAIL)?.trim().toLowerCase();

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(pool),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: { signIn: "/sign-in" },
  callbacks: {
    // Only the owner email passes — rejected before any auth-table write.
    async signIn({ user }) {
      if (!user.email) return false;
      if (!OWNER_EMAIL) {
        console.warn("[auth] OWNER_EMAIL/ALLOWED_EMAIL not configured; rejecting sign-in");
        return false;
      }
      return user.email.toLowerCase() === OWNER_EMAIL;
    },
    // Carry the legacy Supabase owner UUID so existing diagrams (user_id =
    // that UUID) keep resolving without a data migration.
    async session({ session, user }) {
      const legacy = process.env.OWNER_USER_ID?.trim();
      if (session.user) {
        const su = session.user as { id?: string; legacyId?: string };
        su.id = user.id;
        su.legacyId = legacy ?? user.id;
      }
      return session;
    },
  },
  session: { strategy: "database" },
});
