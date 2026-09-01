import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

/**
 * Document blob storage (PRD 8.2 — "Postgres + S3-compatible blob storage").
 * Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is configured; falls back to a
 * gitignored .uploads/ directory for local mock-data dev. The Document row
 * stores the return value of putDocument() in `blobUrl` — either an https
 * URL or a "local:<uuid>" marker the download route resolves.
 */

const LOCAL_DIR = path.join(process.cwd(), ".uploads");
const LOCAL_PREFIX = "local:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function putDocument(
  filename: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { put } = await import("@vercel/blob");
    const res = await put(`documents/${randomUUID()}-${filename}`, bytes, {
      access: "public",
      contentType,
      token,
    });
    return res.url;
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  const id = randomUUID();
  await writeFile(path.join(LOCAL_DIR, id), bytes);
  await writeFile(
    path.join(LOCAL_DIR, `${id}.json`),
    JSON.stringify({ filename, contentType }),
  );
  return `${LOCAL_PREFIX}${id}`;
}

export function isLocalRef(ref: string): boolean {
  return ref.startsWith(LOCAL_PREFIX);
}

export async function readLocalDocument(
  ref: string,
): Promise<{ bytes: Buffer; contentType: string; filename: string } | null> {
  if (!isLocalRef(ref)) return null;
  const id = ref.slice(LOCAL_PREFIX.length);
  if (!UUID_RE.test(id)) return null; // guard against path traversal
  try {
    const bytes = await readFile(path.join(LOCAL_DIR, id));
    let meta = { filename: "document", contentType: "application/octet-stream" };
    try {
      meta = JSON.parse(await readFile(path.join(LOCAL_DIR, `${id}.json`), "utf8"));
    } catch {
      /* sidecar missing — fall back to defaults */
    }
    return { bytes, contentType: meta.contentType, filename: meta.filename };
  } catch {
    return null;
  }
}
