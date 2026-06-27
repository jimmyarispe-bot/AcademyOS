import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { EdpImportType, FieldMapping } from "@/lib/enterprise-data/types";
import { DEFAULT_QUICKBOOKS_MAPPINGS, DEFAULT_STUDENT_MAPPINGS } from "@/lib/enterprise-data/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export function getDefaultMappings(importType: EdpImportType): FieldMapping[] {
  if (importType === "quickbooks" || importType === "financial_transaction") return DEFAULT_QUICKBOOKS_MAPPINGS;
  if (importType === "student") return DEFAULT_STUDENT_MAPPINGS;
  return [];
}

export async function getMappingTemplates(supabase: AuthClient, organizationId: string, importType?: string) {
  let query = supabase.from("edp_mapping_templates").select("*").eq("organization_id", organizationId).order("template_name");
  if (importType) query = query.eq("import_type", importType);
  const { data } = await query;
  return data ?? [];
}

export async function saveMappingTemplate(
  supabase: AuthClient,
  input: {
    organizationId: string;
    templateName: string;
    importType: string;
    fieldMappings: FieldMapping[];
    transformationRules?: unknown[];
    lookupTables?: Record<string, unknown>;
    conditionalMappings?: unknown[];
    isDefault?: boolean;
    createdBy?: string;
  }
) {
  const { data, error } = await supabase
    .from("edp_mapping_templates")
    .upsert(
      {
        organization_id: input.organizationId,
        template_name: input.templateName,
        import_type: input.importType,
        field_mappings: input.fieldMappings,
        transformation_rules: input.transformationRules ?? [],
        lookup_tables: input.lookupTables ?? {},
        conditional_mappings: input.conditionalMappings ?? [],
        is_default: input.isDefault ?? false,
        created_by: input.createdBy ?? null,
      },
      { onConflict: "organization_id,template_name,import_type" }
    )
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { templateId: data.id };
}

export function applyTransformation(value: unknown, rule?: string): unknown {
  if (!rule || value == null) return value;
  const str = String(value);
  if (rule === "uppercase") return str.toUpperCase();
  if (rule === "lowercase") return str.toLowerCase();
  if (rule === "trim") return str.trim();
  if (rule.startsWith("default:")) return str || rule.slice(8);
  return value;
}

export function mapRecord(raw: Record<string, unknown>, mappings: FieldMapping[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const m of mappings) {
    const src = raw[m.sourceField] ?? raw[m.sourceField.toLowerCase()];
    result[m.targetField] = applyTransformation(src ?? m.defaultValue, m.transform);
  }
  return result;
}
