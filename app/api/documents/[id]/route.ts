import { getSessionUser } from "@/lib/session";
import { getDocumentForDownload } from "@/lib/documents";
import { isLocalRef, readLocalDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const doc = await getDocumentForDownload(user, id);
  if (!doc) return new Response("Not found", { status: 404 });

  if (isLocalRef(doc.blobUrl)) {
    const f = await readLocalDocument(doc.blobUrl);
    if (!f) return new Response("File no longer available", { status: 410 });
    return new Response(new Uint8Array(f.bytes), {
      headers: {
        "Content-Type": f.contentType,
        "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // Vercel Blob (or any https URL) — hand the client straight to it.
  return Response.redirect(doc.blobUrl, 302);
}
