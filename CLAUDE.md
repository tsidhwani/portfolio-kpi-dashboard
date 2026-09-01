# Portfolio KPI Dashboard — project context for Claude Code

## What this is
Internal web app for a private equity firm. Centralizes monthly financials,
operating KPIs, and commentary across every portfolio company in every fund.
Phase 1 builds the full app against mock data only — no live accounting/fund
admin integrations yet, that's a separate future scope.

## Users (do not blur these roles together)
- **Partner** — reads fund/company roll-ups, drills into companies, leaves notes.
- **Deal Team** — enters financials/KPIs, uploads docs, writes commentary, chases CFOs.
- **Portfolio Co. CFO** — submits only their own company's numbers. Must never
  be able to see or fetch another company's data, another fund, or firm-level
  views, even via direct API call. This is enforced in `lib/rbac.ts`, not the UI.
- **Admin** — manages users, role/access assignment, KPI template library.

## Tech stack
Next.js (App Router) + TypeScript, Prisma + Postgres, Auth.js (OAuth only,
no password store), Tailwind + shadcn/ui, Vercel for hosting, Vercel Blob
(or S3-compatible) for documents.

## Schema
Source of truth is `prisma/schema.prisma`. Key entities: Fund, PortfolioCompany,
KpiDefinition, KpiValue, Commentary, Document, User, AuditLogEntry, plus
FundAccess/CompanyAccess join tables for scoping. Don't add ad hoc fields
outside this file — extend the schema first, then run `npm run db:push`.

## Non-negotiable rules
1. **Audit log is append-only.** No update/delete path on `AuditLogEntry`,
   including for Admins. Every create/update/delete on financial data,
   commentary, or documents must call `logAudit()` from `lib/audit.ts` inside
   the same transaction as the mutation.
2. **RBAC is enforced at the API/server-action layer**, never just hidden in
   the UI. Every route touching company data calls the helpers in
   `lib/rbac.ts` first.
3. **OAuth only.** No credentials table, no password reset flow.
4. **This is a monitoring dashboard, not a valuation/fund-accounting system.**
   Don't add waterfall or valuation modeling — that's explicitly out of scope.

## Open decision — resolve before real data goes in
`lib/rbac.ts` currently treats Partner/Deal Team/Admin as firm-wide access
(can see all funds/companies) and CFO as scoped to their own company only.
This was left open in the original PRD because SEC-audit posture usually
expects access scoped to a documented "need," not blanket firm-wide access.
If that gets resolved to "scope Deal Team by coverage," the fix is: add a
coverage check in `canAccessCompany`/`canEditFinancials` using the existing
`FundAccess`/`CompanyAccess` tables (already modeled, just not enforced for
those two roles yet).

## Commands
- `npm run dev` — local dev server
- `npm run db:push` — sync Prisma schema to Postgres (no migration files yet,
  fine for this stage; switch to `prisma migrate` once schema stabilizes)
- `npm run db:studio` — visual DB browser

## Build order (recommended)
1. Fund/company data model + seed script with mock data
2. Monthly entry grid (Deal Team) — this is the core write path everything else reads from
3. Fund-level roll-up + company detail view (Partner read path)
4. CFO restricted submission view
5. Variance flagging (green/yellow/red)
6. Admin: user management + KPI template library
7. PDF/CSV export

## Decisions Log
(Record any open question from this file, once resolved, as a dated one-line
entry here. Example: "2026-08-27 — RBAC scoping: Partner/Deal Team stay
firm-wide, CFO restricted to own company. Confirmed by Tapan.")

- 2026-08-31 — Variance flag thresholds (unfavorable side, % of |budget|):
  within 5% → GREEN, 5–15% → YELLOW, >15% → RED. Company flag = worst
  FINANCIAL-KPI flag for the period; stored `PortfolioCompany.status` is the
  manual fallback when the period has no financial data. Placeholder numbers
  for Phase 1 — revisit with the deal team before real data. Constants in
  `lib/variance.ts` (`VARIANCE_THRESHOLDS`).

## Progress Log
(One line per completed feature or session, most recent at the top. Keep
entries terse — what was built, not how. Example: "2026-08-27 — Auth wired,
Google OAuth login working, no User/role attachment yet.")

- 2026-08-31 — Build order step 6: Admin surface. `/admin` (user
  management) + `/admin/kpis` (KPI template library), ADMIN-only via
  `canManageUsers` (page redirect + re-checked in every action). New
  `lib/admin.ts` (`upsertUser`/`upsertKpiDefinition` + reads; zod-validated,
  transactional, audit-logged as entityType User/KpiDefinition),
  `admin/actions.ts` thin `"use server"` wrapper, client panels. Schema:
  `User.active` added (`db:push` run) — `false` blocks sign-in on next
  request (wired into `lib/auth.ts` signIn + jwt); no user delete path.
  Guards: CFO needs ≥1 company, unique email + KPI name, admin can't
  self-demote or self-deactivate. `db:grant` now also re-activates.
  Fund/company access assignable for all roles but still only enforced for
  CFO (see open decision). 22-check harness against dev DB passing.
- 2026-08-31 — Build order step 5: variance flagging. New `lib/variance.ts`
  (`flagForVariance`/`rollUpFlags`/`VARIANCE_THRESHOLDS`, pure). Reporting
  layer computes per-cell flags + a per-period company flag (worst financial
  KPI, stored status as fallback); `getFundRollups` G/Y/R counts,
  `/funds/[id]` status column + variance colours, and `/companies/[id]` KPI
  grid + header badge now driven by variance. `ui.tsx` gains `flagTextClass`
  + `VarianceLegend`. No schema change.
- 2026-08-27 — Build order step 4: CFO restricted view. `/submit`
  single-company submission (no picker, defaults to most recent unfilled
  month), reuses EntryGrid + saveKpiValues. CFO redirected here from `/`
  and `/entry`; nav swapped to Submit / My Company. 14-check CFO isolation
  matrix passing (no cross-company/fund/firm read or write, tampered
  companyId rejected server-side, own writes tagged CFO_SUBMISSION).
- 2026-08-27 — Build order step 3: Partner read path. `/funds` roll-up
  (per-fund status counts + additive Revenue/EBITDA/Headcount, "as of" the
  latest month complete for all companies), `/funds/[id]` company list with
  actual-vs-budget, `/companies/[id]` detail (6-mo KPI grid + commentary +
  documents). New `lib/reporting.ts`, `lib/format.ts`; `canViewFirmWide()`
  added to rbac (CFO redirected to their company). Reads gated via
  canAccessCompany/canViewFirmWide.
- 2026-08-27 — Build order step 2: monthly entry grid at `/entry`
  (`app/(dashboard)/`). Company + month selectors, editable actual/budget
  per KPI. Write path = `lib/kpi-entry.ts` `applyKpiEntry()` (RBAC check +
  KpiValue upsert + AuditLogEntry in one tx; CFO writes tagged
  CFO_SUBMISSION); `actions.ts` is the thin `"use server"` wrapper. Added
  `lib/periods.ts`, `lib/companies.ts`, `(dashboard)` layout/home. Verified
  create/update/no-op/deny/bad-input paths.
- 2026-08-27 — Auth wired: Google OAuth, JWT sessions (no DB adapter).
  `signIn` denies non-provisioned emails; `jwt`/`session` attach
  id/role/fundIds/companyIds from the User row. Added `lib/prisma.ts`
  singleton, `lib/session.ts` (`getSessionUser`/`requireSessionUser`),
  `/login` page, next-auth type augmentation. `logAudit()` now takes an
  optional tx client. Added `npm run db:grant -- <email> <ROLE> [companyId...]`
  to provision real accounts (OAuth gate only admits known emails).
  Google client ID/secret live in `.env.local`. Not yet done: route
  middleware, per-route rbac calls (deferred to feature work).
- 2026-08-27 — Build order step 1: schema pushed to local Postgres,
  deterministic mock-data seed added (`npm run db:seed` / `db:reset`) —
  3 funds, 8 companies, 6 KPIs × 12 months, commentary/documents/audit rows.

## Working agreement for future sessions
- Read this whole file before starting any task.
- Before ending a session, append one line to Progress Log summarizing what
  changed, and add to Decisions Log if any open question got resolved.
- If Progress Log passes ~15 entries, condense the oldest ones into a single
  summary line instead of deleting them, so the file doesn't bloat.
- Never remove or contradict a Decisions Log entry without flagging it to
  Tapan explicitly first — those are settled unless he says otherwise.
