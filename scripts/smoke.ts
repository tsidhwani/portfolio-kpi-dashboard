/**
 * End-to-end smoke check for the lib/ logic layer against a live dev DB.
 * Not a substitute for a real test runner — it's a fast "did anything
 * obvious break" pass over RBAC, the write paths, reporting, and export.
 *
 *   npm run db:smoke
 *
 * Reseeds a clean baseline first and again at the end, so it's safe to run
 * repeatedly. Never point it at anything but a local/dev database.
 */
import { execSync } from "child_process";
import { rm } from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";
import type { SessionUser } from "../lib/rbac";
import {
  canManageKpiTemplates,
  canManageUsers,
  canEditCommentary,
  canUploadDocuments,
  canViewAuditLog,
  canViewFirmWide,
} from "../lib/rbac";
import { saveCommentary } from "../lib/commentary";
import { uploadDocument, getDocumentForDownload } from "../lib/documents";
import { listAuditEntries } from "../lib/audit-log";
import {
  getPortfolioTriage,
  getFundRollups,
  getFundDetail,
  getCompanyDetail,
  reportingPeriodKey,
} from "../lib/reporting";
import { upsertUser, upsertKpiDefinition, listUsers, listKpiDefinitions } from "../lib/admin";
import { getKpiDefsFor } from "../lib/kpi-defs";
import { toCsv, fundRollupRows, fundDetailRows, companyHistoryRows } from "../lib/export";

const admin: SessionUser = { id: "usr_admin", role: "ADMIN", fundIds: [], companyIds: [] };
const partner: SessionUser = { id: "usr_partner", role: "PARTNER", fundIds: [], companyIds: [] };
const deal1: SessionUser = { id: "usr_deal1", role: "DEAL_TEAM", fundIds: [], companyIds: [] };
const cfoHelix: SessionUser = { id: "usr_cfo_helix", role: "CFO", fundIds: [], companyIds: ["co_helix"] };

let pass = 0;
let fail = 0;
const ok = (n: string, c: boolean, extra?: unknown) => {
  if (c) {
    pass++;
    console.log(`  ok  ${n}`);
  } else {
    fail++;
    console.log(`FAIL  ${n}`, extra ?? "");
  }
};

async function main() {
  console.log("reseeding clean baseline…");
  execSync("npm run db:seed", { stdio: "ignore" });

  const created = {
    users: [] as string[],
    kpis: [] as string[],
    commentary: [] as string[],
    docs: [] as string[],
    localRefs: [] as string[],
  };

  try {
    // ---- RBAC ----
    ok("firm-wide: partner yes / CFO no", canViewFirmWide(partner) && !canViewFirmWide(cfoHelix));
    ok("manage users: admin only", canManageUsers(admin) && !canManageUsers(deal1));
    ok("manage KPI templates: deal team yes / CFO no", canManageKpiTemplates(deal1) && !canManageKpiTemplates(cfoHelix));
    ok("commentary: CFO own only", canEditCommentary(cfoHelix, "co_helix") && !canEditCommentary(cfoHelix, "co_summit"));
    ok("documents: partner anywhere", canUploadDocuments(partner, "co_summit"));
    ok("audit log: CFO no", !canViewAuditLog(cfoHelix));

    // ---- Users (admin) ----
    const u = await upsertUser(admin, {
      email: "smoke.partner@example.com", name: "Smoke Partner", role: "PARTNER",
      active: true, fundIds: [], companyIds: [],
    });
    ok("user create ok", u.status === "ok", u);
    if (u.status === "ok") created.users.push(u.data!.id);
    ok("user create CFO w/o company rejected",
      (await upsertUser(admin, { email: "x@example.com", name: "X", role: "CFO", active: true, fundIds: [], companyIds: [] })).status === "error");
    ok("admin can't self-demote",
      (await upsertUser(admin, { id: "usr_admin", email: "sam.ortiz@meridiancap.example", name: "Sam Ortiz", role: "PARTNER", active: true, fundIds: [], companyIds: [] })).status === "error");
    ok("user create denied for deal team",
      (await upsertUser(deal1, { email: "y@example.com", name: "Y", role: "ADMIN", active: true, fundIds: [], companyIds: [] })).status === "error");
    ok("listUsers returns roster", (await listUsers(admin)).length >= 7);

    // ---- KPI templates ----
    const k = await upsertKpiDefinition(deal1, {
      name: "Smoke NRR", category: "OPERATIONAL", unit: "%", cadence: "monthly", appliesTo: "Fintech", isCustom: true,
    });
    ok("KPI create by deal team", k.status === "ok", k);
    if (k.status === "ok") created.kpis.push(k.data!.id);
    ok("KPI dup name rejected",
      (await upsertKpiDefinition(deal1, { name: " revenue ", category: "FINANCIAL", unit: "USD" })).status === "error");
    ok("KPI create denied for CFO",
      (await upsertKpiDefinition(cfoHelix, { name: "Nope", category: "FINANCIAL", unit: "USD" })).status === "error");
    ok("appliesTo: Fintech sees it, Logistics doesn't",
      (await getKpiDefsFor({ industry: "Fintech" })).some((d) => d.name === "Smoke NRR") &&
      !(await getKpiDefsFor({ industry: "Logistics" })).some((d) => d.name === "Smoke NRR"));
    if (k.status === "ok") {
      await upsertKpiDefinition(deal1, {
        id: k.data!.id, name: "Smoke NRR", category: "OPERATIONAL", unit: "%", cadence: "monthly", appliesTo: "Fintech", retired: true,
      });
      ok("retired KPI hidden from company set",
        !(await getKpiDefsFor({ industry: "Fintech" })).some((d) => d.name === "Smoke NRR"));
      ok("retired KPI still in library",
        (await listKpiDefinitions(deal1)).some((r) => r.id === k.data!.id && r.retired));
    }
    const names = (await getKpiDefsFor(null)).map((d) => d.name);
    ok("standard set has Net Debt + EBITDA Margin",
      names.includes("Net Debt") && names.includes("EBITDA Margin"), names);

    // ---- Commentary ----
    const c1 = await saveCommentary(partner, { companyId: "co_summit", period: "2026-07", body: "Smoke note v1" });
    ok("commentary create", c1.status === "saved", c1);
    if (c1.status === "saved") created.commentary.push(c1.id);
    const c2 = await saveCommentary(partner, { companyId: "co_summit", period: "2026-07", body: "Smoke note v2" });
    ok("commentary upsert (same author/period)", c2.status === "saved" && (c1.status === "saved" && c2.id === c1.id));
    ok("commentary denied: CFO other company",
      (await saveCommentary(cfoHelix, { companyId: "co_summit", period: "2026-07", body: "no" })).status === "error");
    ok("commentary clear",
      (await saveCommentary(partner, { companyId: "co_summit", period: "2026-07", body: "" })).status === "deleted");

    // ---- Documents ----
    const bytes = Buffer.from("%PDF-1.4 smoke\n");
    const file = (n = "d.pdf", t = "application/pdf") => new File([bytes], n, { type: t });
    ok("doc upload denied: CFO other company",
      (await uploadDocument(cfoHelix, { companyId: "co_summit", category: "report", file: file() })).status === "error");
    ok("doc upload rejects bad type",
      (await uploadDocument(deal1, { companyId: "co_summit", category: "report", file: file("x.exe", "application/x-msdownload") })).status === "error");
    const d = await uploadDocument(deal1, { companyId: "co_summit", category: "board_deck", file: file() });
    ok("doc upload ok (deal team)", d.status === "uploaded", d);
    if (d.status === "uploaded") {
      created.docs.push(d.id);
      const row = await prisma.document.findUnique({ where: { id: d.id } });
      if (row?.blobUrl.startsWith("local:")) created.localRefs.push(row.blobUrl.slice(6));
      ok("doc downloadable by partner", !!(await getDocumentForDownload(partner, d.id)));
      ok("doc NOT downloadable by CFO of another co", (await getDocumentForDownload(cfoHelix, d.id)) === null);
    }

    // ---- Audit trail + viewer ----
    const types = new Set((await prisma.auditLogEntry.groupBy({ by: ["entityType"] })).map((a) => a.entityType));
    ok("audit rows for Commentary + Document + KpiDefinition",
      types.has("Commentary") && types.has("Document") && types.has("KpiDefinition"), [...types]);
    ok("audit viewer: entries for partner, empty for CFO",
      (await listAuditEntries(partner, {})).entries.length > 0 &&
      (await listAuditEntries(cfoHelix, {})).entries.length === 0);
    ok("audit viewer filters by type",
      (await listAuditEntries(partner, { entityType: "Document" })).entries.every((e) => e.entityType === "Document"));

    // ---- Reporting ----
    const pk = (await reportingPeriodKey())!;
    const triage = await getPortfolioTriage(partner, pk);
    const rank = { RED: 0, YELLOW: 1, GREEN: 2 } as Record<string, number>;
    ok("triage: 8 companies, worst-first, drivers on flagged",
      triage.length === 8 &&
      triage.every((c, i) => i === 0 || rank[triage[i - 1].status] <= rank[c.status]) &&
      triage.filter((c) => c.status !== "GREEN").every((c) => c.drivers.length > 0));
    ok("triage scoped for CFO", (await getPortfolioTriage(cfoHelix, pk)).length === 1);

    const rollups = await getFundRollups(partner, pk);
    ok("fund rollups: 3 funds, net debt present", rollups.length === 3 && rollups.every((r) => r.netDebt != null));
    ok("CFO gets no rollups", (await getFundRollups(cfoHelix, pk)).length === 0);

    const detail = await getCompanyDetail(partner, "co_northwind", 12);
    const rev = detail!.kpiDefs.find((x) => x.name === "Revenue")!;
    const tr = detail!.trend[rev.id];
    ok("company detail: MoM/QoQ/YoY all present", tr && tr.mom != null && tr.qoq != null && tr.yoy != null, tr);
    ok("CFO denied another company's detail", (await getCompanyDetail(cfoHelix, "co_northwind", 6)) === null);
    ok("CFO denied fund detail", (await getFundDetail(cfoHelix, "fund_gf2", pk)) === null);

    // ---- Export ----
    const rollupCsv = toCsv(fundRollupRows(rollups, pk)).split("\r\n");
    ok("rollup CSV: title + header + 3 rows, Net Debt column",
      rollupCsv.length === 5 && rollupCsv[1].includes("Net Debt"));
    const fd = await getFundDetail(partner, "fund_gf2", pk);
    ok("fund detail CSV has EBITDA Margin + Net Debt columns",
      toCsv(fundDetailRows(fd!)).split("\r\n")[1].includes("EBITDA Margin Actual") &&
      toCsv(fundDetailRows(fd!)).split("\r\n")[1].includes("Net Debt Actual"));
    const chCsv = toCsv(companyHistoryRows(detail!)).split("\r\n");
    ok("company history CSV header + flag column",
      chCsv[1] === "Metric,Unit,Period,Actual,Budget,Variance %,Flag" && /,(GREEN|YELLOW|RED)$/m.test(chCsv.join("\n")));
  } finally {
    for (const ref of created.localRefs) {
      await rm(path.join(process.cwd(), ".uploads", ref)).catch(() => {});
      await rm(path.join(process.cwd(), ".uploads", `${ref}.json`)).catch(() => {});
    }
    await prisma.$disconnect();
    console.log("\nrestoring clean baseline…");
    execSync("npm run db:seed", { stdio: "ignore" });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
