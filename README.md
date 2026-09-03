# Portfolio KPI Dashboard

Internal web app for a private equity firm to centralise monthly financials,
operating KPIs, and commentary across every portfolio company in every fund.
Phase 1 — built against deterministic **sample data**, no live integrations.

Next.js 15 (App Router) · TypeScript · Prisma + Postgres · Auth.js (OAuth) ·
Tailwind. Full context and decisions live in [`CLAUDE.md`](./CLAUDE.md).

---

## Quick start (demo mode — no Google account)

Requires **Node 20+** and a **Postgres** database (local, or a free
[Neon](https://neon.tech) / [Supabase](https://supabase.com) instance).

```bash
git clone <this-repo> && cd portfolio-kpi-dashboard
npm install

# 1. point at a database
cp .env.example .env
#    edit .env  ->  DATABASE_URL=postgresql://<you>@localhost:5432/portfolio_kpi_dev?schema=public
#    (createdb portfolio_kpi_dev first, if using local Postgres)

# 2. add an auth secret
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env

# 3. create the schema + load sample data
npm run db:push
npm run db:seed

# 4. run it
npm run dev
```

Open **http://localhost:3000**. Demo login is on by default in dev — pick
**Admin / Partner / Deal team / CFO** on the sign-in screen and start
clicking. Each button signs you in as one of the seeded users for that role.

> Demo login only ever resolves to a user that already exists in the
> database, and is **off in production** unless `DEMO_LOGIN=1`.

### What each role sees

| Role | Can do |
|---|---|
| **Partner** | Read fund roll-ups, drill into companies, leave notes |
| **Deal team** | Enter monthly KPIs, upload documents, write commentary, manage the KPI library |
| **CFO** | One company only — submit that company's numbers, comment, upload. No firm-wide views |
| **Admin** | Everything, plus user management |

---

## Production sign-in (Google OAuth)

Google is the real auth path; demo login is a convenience.

1. Google Cloud Console → **Credentials → OAuth client ID** (Web).
   Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   (or your deployed origin).
2. Put the id/secret in `.env.local`:
   ```
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```
3. Only provisioned emails may sign in. Add yourself:
   ```bash
   npm run db:grant -- you@example.com ADMIN
   # CFO needs a company:  npm run db:grant -- cfo@acme.com CFO co_northwind
   ```

## Deploying (Vercel + Neon)

1. Neon: create a project, copy the connection string.
2. Vercel: import the repo. Set env vars — `DATABASE_URL`, `AUTH_SECRET`,
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and `DEMO_LOGIN=1` if you
   want reviewers to click in without Google.
3. Locally, point `DATABASE_URL` at Neon and run `npm run db:push && npm run db:seed`.
4. `npm run db:grant -- <reviewer-email> ADMIN` if you're using Google.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build + type-check |
| `npm run db:push` | Sync Prisma schema to Postgres |
| `npm run db:seed` | Wipe + load deterministic sample data |
| `npm run db:reset` | Drop, recreate, reseed |
| `npm run db:studio` | Visual DB browser |
| `npm run db:grant -- <email> <ROLE> [companyId...]` | Provision a real account |
| `npm run db:smoke` | 40-check logic-layer smoke (RBAC, write paths, audit, exports); reseeds before and after |

## Sample dataset

3 funds · 8 portfolio companies · 7 KPI definitions × 15 months · commentary,
documents, and an audit log. Deterministic — `npm run db:seed` always
produces the same data.

## Known limitations

It's a Phase-1 trial build. Not deployed by default; commentary is plain
text (not rich text); CFO submissions are live on save (no approval step);
access is firm-wide for Partner/Deal Team; no test suite beyond `db:smoke`.
Full list and rationale in [`CLAUDE.md`](./CLAUDE.md).
