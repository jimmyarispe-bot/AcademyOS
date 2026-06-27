import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import { importCsvFinancialData } from "@/lib/financial-intelligence/csv-import";
import type { QuickBooksImportType } from "@/lib/financial-intelligence/quickbooks-import";

export async function POST(request: NextRequest) {
  const supabase = await createAuthClient();
  let gate = await guardApiRoute(supabase, "fi.import");
  if (gate instanceof NextResponse) {
    gate = await guardApiRoute(supabase, "fi.manage");
    if (gate instanceof NextResponse) return gate;
  }

  const body = await request.json();
  const schoolId = body.school_id as string | undefined;
  const csvContent = body.csv_content as string | undefined;
  const importType = (body.import_type ?? "transactions") as QuickBooksImportType;

  if (!schoolId || !csvContent) {
    return NextResponse.json({ error: "school_id and csv_content required" }, { status: 400 });
  }

  const result = await importCsvFinancialData(supabase, {
    schoolId,
    importType,
    csvContent,
    fileName: body.file_name,
    importedBy: body.imported_by,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
