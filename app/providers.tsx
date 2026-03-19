// No global providers needed — Supabase auth is handled via cookies + SSR
export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
