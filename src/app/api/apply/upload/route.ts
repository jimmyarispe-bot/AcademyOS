import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  checkRateLimitAsync,
  getClientIpFromHeaders,
} from "@/lib/platform/api-rate-limit";

/**
 * POST /api/apply/upload — a document from a family who has no account yet.
 *
 * WHY A ROUTE HANDLER AND NOT A SERVER ACTION. Server actions cap request
 * bodies at 1MB by default. A photograph of an award letter taken on a phone is
 * routinely three to five megabytes, so a server action would reject the most
 * common case while working perfectly in testing with a small PDF.
 *
 * WHY NOT UPLOAD STRAIGHT TO STORAGE FROM THE BROWSER. That is what the parent
 * portal does, and it works there because the parent is signed in and row
 * policies decide what they may write. On the public inquiry form there is no
 * account yet, and handing an unauthenticated browser storage credentials is
 * how a bucket becomes somebody else's free file host. Everything is checked
 * here, on the server, before anything is written.
 *
 * WHAT IS CHECKED, AND WHY EACH ONE:
 *   - Content type against an allowlist. GOAL asks for PDF, JPG or PNG and so
 *     does this. An allowlist rather than a blocklist, because the interesting
 *     file types are always the ones nobody thought of.
 *   - Size. Ten megabytes is generous for a phone photograph and small enough
 *     that nobody stores a film here.
 *   - Rate limit by IP, the same mechanism the inquiry form itself uses.
 *
 * WHERE IT GOES. A quarantine prefix, under a name this server generates. The
 * filename a browser supplies is attacker-controlled and is never used as a
 * path — it is kept only as a label to show the family what they attached.
 * Nothing is attached to a lead until the form is submitted; a file uploaded by
 * somebody who then closes the tab belongs to nobody and is cleaned up by the
 * bucket's lifecycle rules rather than by being silently attached to a record.
 */

const BUCKET = "admissions-documents";
const PREFIX = "interest-uploads";
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function POST(request: Request) {
  const headerStore = await headers();
  const ip = getClientIpFromHeaders(headerStore);

  const limited = await checkRateLimitAsync(`apply-upload:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is larger than 10MB. Please attach a smaller one." },
      { status: 400 }
    );
  }

  const extension = ALLOWED[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Please attach a PDF, JPG or PNG." },
      { status: 400 }
    );
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json(
      { error: "Uploads are unavailable right now. Please contact the school." },
      { status: 503 }
    );
  }

  // The path is generated here. A filename from the browser is never trusted
  // into a path — "../" is the oldest trick there is.
  const path = `${PREFIX}/${randomUUID()}.${extension}`;

  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("[apply/upload] storage rejected the file", error.message);
    return NextResponse.json(
      { error: "We could not save that file. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path,
    // Shown back to the family so they can see what they attached. Never used
    // as a path, and truncated because a filename is free-form text from a
    // stranger.
    fileName: file.name.slice(0, 120),
    size: file.size,
  });
}
