"use server";

import { requireSessionUser } from "@/lib/session";
import { saveCommentary as saveCommentaryCore, type CommentaryResult } from "@/lib/commentary";
import { uploadDocument as uploadDocumentCore, type UploadResult } from "@/lib/documents";

/**
 * Client-callable writes for the company detail page. Each resolves the
 * session to a SessionUser and hands off to lib/*, which re-checks RBAC and
 * writes the audit row in the same transaction.
 */

export async function saveCommentary(raw: unknown): Promise<CommentaryResult> {
  const user = await requireSessionUser();
  return saveCommentaryCore(user, raw);
}

export async function uploadDocument(form: FormData): Promise<UploadResult> {
  const user = await requireSessionUser();
  const file = form.get("file");
  return uploadDocumentCore(user, {
    companyId: String(form.get("companyId") ?? ""),
    category: String(form.get("category") ?? ""),
    file: file instanceof File ? file : null,
  });
}
