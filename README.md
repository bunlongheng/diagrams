# Mermaid++ - AI-Powered Diagram Generator

Paste any Mermaid syntax and get a beautiful rendered diagram instantly -- or describe what you want in plain English and let AI generate it for you.

**Live --> [mermaid-bheng.netlify.app](https://mermaid-bheng.netlify.app)**

![Screenshot](screenshot.png)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15.1.0, React 19.0.0, TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + localhost bypass |
| AI | Claude API (`@anthropic-ai/sdk`) using `claude-sonnet-4-6` |
| Rendering | Mermaid.js |
| UI | lucide-react, prismjs, react-simple-code-editor |
| Utilities | lz-string, canvas-confetti, qrcode.react |
| Testing | Vitest (unit) + Playwright (E2E) |
| Hosting | Vercel + Netlify |
| Build | Turbo cache enabled |

---

## Architecture

```
app/
  page.tsx              # Main diagram editor (server component)
  DiagramsClient.tsx    # Client-side editor + canvas logic
  DiagramsShell.tsx     # Layout shell with auth
  MermaidRenderer.tsx   # Mermaid rendering engine
  CuteToast.tsx         # Toast notifications
  SignInButton.tsx      # Supabase auth button
  providers.tsx         # Context providers
  auth/                 # Auth callback routes
  d/                    # Shared diagram routes
  api/                  # API routes (AI generation, etc.)
lib/                    # Shared utilities + Supabase client
supabase/               # Migrations + DB config
tests/                  # Vitest + Playwright tests
public/                 # Static assets
```

---

## Features

- **AI diagram generation** -- describe what you want in plain English, Claude generates the Mermaid syntax
- **Multi-diagram support** -- flowcharts, sequence, class, state, ER, Gantt, pie, mindmap, timeline, gitGraph
- **Custom sequence renderer** -- hand-crafted colorful SVG with colored lifelines, pill labels, icons, and step numbers
- **Pan and zoom canvas** -- scroll to pan, Ctrl+scroll to zoom, pinch-to-zoom on mobile, double-click to zoom in, `F` to fit
- **Dark / Light / Monokai themes**
- **Export as PNG/SVG** -- 2x retina PNG, raw code, JSON export, copy to clipboard
- **QR code sharing** -- generate a QR code link to any diagram
- **Real-time preview** -- live rendering with Prism.js syntax highlighting
- **Resizable code editor** with dark mode toggle
- **Mobile responsive** -- full-screen code editor + settings bottom sheet
- **Supabase Auth** -- secure login with localhost/LAN bypass for development

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3002 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run prod` | Build + start on port 3002 (0.0.0.0) |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API key for AI diagram generation |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `AI_API_SECRET` | Secret for AI API route protection |
| `ALLOWED_EMAIL` | Email allowed for auth access |

---

## Project Structure

```
diagrams/
  app/                  # Next.js App Router pages + components
  lib/                  # Utilities, Supabase client, helpers
  supabase/             # Database migrations
  tests/                # Unit + E2E test suites
  public/               # Static assets + icons
  scripts/              # Build + deploy scripts
  tailwind.config.js    # Tailwind configuration
  vitest.config.ts      # Vitest configuration
  playwright.config.ts  # Playwright configuration
  turbo.json            # Turbo cache config
  vercel.json           # Vercel deploy config
```

---

Built by [Bunlong Heng](https://www.bunlongheng.com) | [GitHub](https://github.com/bunlongheng/diagrams)
