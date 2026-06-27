import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canImportData } from "@/lib/enterprise-data/access";
import { getPrimaryOrganizationId } from "@/lib/enterprise-data/context";
import { createImportBatch, parseAndStageImport, commitImportBatch } from "@/lib/enterprise-data/import-engine";
import { getDefaultMappings } from "@/lib/enterprise-data/mapping-engine";
import { validateImportBatch } from "@/lib/enterprise-data/validation-engine";
import { COMMITTABLE_IMPORT_TYPES, type EdpImportType, type EdpSourceFormat } from "@/lib/enterprise-data/types";

export async function POST(request: Request) {
  const ctx = await getIdentityContext();
  if (!ctx || !canImportData(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const importType = (body.importType ?? "student") as EdpImportType;
  const sourceFormat = (body.sourceFormat ?? "csv") as EdpSourceFormat;
  const content = body.content ?? "";

  const batch = await createImportBatch(supabase, {
    organizationId: orgId,
    importType,
    sourceFormat,
    fileName: body.fileName,
    importedBy: ctx.effectiveUserId,
    schoolId: body.schoolId,
  });

  if (batch.error || !batch.batchId) {
    return NextResponse.json({ error: batch.error }, { status: 400 });
  }

  const mappings = body.fieldMappings ?? getDefaultMappings(importType);
  await parseAndStageImport(supabase, batch.batchId, content, mappings);
  await validateImportBatch(supabase, batch.batchId, importType, mappings);

  if (body.commit) {
    if (!COMMITTABLE_IMPORT_TYPES.includes(importType)) {
      return NextResponse.json(
        {
          error: `Import type "${importType}" does not support commit in v1.0. Supported: ${COMMITTABLE_IMPORT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    await commitImportBatch(supabase, batch.batchId, importType);
  }

  return NextResponse.json({ batchId: batch.batchId });
}
