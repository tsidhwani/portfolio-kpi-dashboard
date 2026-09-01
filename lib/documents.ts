import { z } from "zod";
import { AuditAction } from "@prisma/client";
import { prisma } from "./prisma";
import { canUploadDocuments, canAccessCompany, type SessionUser } from "./rbac";
import { logAudit } from "./audit";
import { putDocument } from "./storage";

/**
 * Document upload (PRD 6.3 / 5.1). Per company, categorised, attributed to
 * the uploader, timestamped, and recorded in the audit trail (PRD 8.1).
 * "Basic versioning" = upload history: each upload is a new Document row,
 * nothing is overwritten and there is no delete path.
 */

export const DOC_CATEGORIES = ["board_deck", "report", "legal", "other"] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — plenty for a board deck
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/msword",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
]);

export type UploadResult =
  | { status: "uploaded"; id: string }
  | { status: "error"; message: string };

const Meta = z.object({
  companyId: z.string().min(1),
  category: z.enum(DOC_CATEGORIES),
});

export async function uploadDocument(
  user: SessionUser,
  input: { companyId: string; category: string; file: File | null },
): Promise<UploadResult> {
  const parsed = Meta.safeParse({ companyId: input.companyId, category: input.category });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { companyId, category } = parsed.data;

  if (!canUploadDocuments(user, companyId)) {
    return { status: "error", message: "You don't have permission to upload for this company." };
  }
  const company = await prisma.portfolioCompany.findUnique({ where: { id: companyId } });
  if (!company) return { status: "error", message: "Unknown company." };

  const file = input.file;
  if (!file || file.size === 0) return { status: "error", message: "Choose a file to upload." };
  if (file.size > MAX_BYTES) {
    return { status: "error", message: "File exceeds the 20 MB limit." };
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return { status: "error", message: `Unsupported file type: ${file.type}` };
  }

  const filename =
    file.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 200) || "document";
  const bytes = Buffer.from(await file.arrayBuffer());
  const ref = await putDocument(filename, bytes, file.type || "application/octet-stream");

  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: { companyId, filename, blobUrl: ref, uploaderId: user.id, category },
    });
    await logAudit(
      {
        actorId: user.id,
        action: AuditAction.CREATE,
        entityType: "Document",
        entityId: doc.id,
        after: { companyId, filename, category, bytes: bytes.length },
      },
      tx,
    );
    return doc.id;
  });

  return { status: "uploaded", id };
}

/** The Document row if the user may read it, else null (RBAC for the route). */
export async function getDocumentForDownload(user: SessionUser, id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return null;
  if (!canAccessCompany(user, doc.companyId)) return null;
  return doc;
}
