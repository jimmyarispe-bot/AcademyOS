export type EdpImportType =
  | "organization" | "school" | "campus" | "program" | "student" | "family" | "guardian"
  | "employee" | "teacher" | "course" | "section" | "schedule" | "attendance" | "behavior"
  | "medical" | "iep" | "504_plan" | "intervention" | "assessment" | "scholarship"
  | "state_funding" | "financial_transaction" | "payroll" | "vendor" | "asset" | "inventory"
  | "project" | "task" | "document" | "communication" | "historical" | "quickbooks" | "configuration";

export type EdpSourceFormat = "csv" | "excel" | "json" | "xml" | "zip" | "quickbooks" | "google_sheets" | "api";
export type EdpExportFormat = "csv" | "excel" | "json" | "xml" | "zip";
export type MigrationStep = "upload" | "mapping" | "validation" | "preview" | "conflicts" | "import" | "verification" | "report";
export type ValidationSeverity = "error" | "warning" | "info" | "recommendation";

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  fieldName?: string;
  rowNumber?: number;
  resolutionHint?: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  mapped: Record<string, unknown>;
  status: "valid" | "warning" | "error";
  issues: ValidationIssue[];
}

export interface ConnectorDefinition {
  connectorKey: string;
  displayName: string;
  description?: string;
  category: string;
  supportsImport: boolean;
  supportsExport: boolean;
  supportsSync: boolean;
  authType: string;
}

export interface DataQualityReport {
  qualityScore: number;
  duplicateStudents: number;
  duplicateFamilies: number;
  missingContacts: number;
  brokenRelationships: number;
  incompleteRecords: number;
  orphanedFiles: number;
  issues: ValidationIssue[];
  correctiveActions: string[];
}

export interface MonitoringSummary {
  importCount: number;
  exportCount: number;
  syncCount: number;
  failedImports: number;
  failedExports: number;
  failedSyncs: number;
  connectorHealth: Array<{ connectorKey: string; healthStatus: string }>;
}

export const EDP_NAV = [
  { href: "/dashboard/data", label: "Data Hub", exact: true as const },
  { href: "/dashboard/data/import", label: "Import" },
  { href: "/dashboard/data/export", label: "Export" },
  { href: "/dashboard/data/mappings", label: "Mappings" },
  { href: "/dashboard/data/connectors", label: "Connectors" },
  { href: "/dashboard/data/api", label: "API" },
  { href: "/dashboard/data/webhooks", label: "Webhooks" },
  { href: "/dashboard/data/backups", label: "Backups" },
  { href: "/dashboard/data/archive", label: "Archive" },
  { href: "/dashboard/data/quality", label: "Quality" },
  { href: "/dashboard/data/warehouse", label: "Warehouse" },
  { href: "/dashboard/data/clone", label: "Clone" },
] as const;

/** Import types that commit to domain tables in v1.0 */
export const COMMITTABLE_IMPORT_TYPES: EdpImportType[] = [
  "quickbooks",
  "financial_transaction",
];

export const IMPORT_TYPES: Array<{ value: EdpImportType; label: string; commitSupported: boolean }> = [
  { value: "student", label: "Students (validate only)", commitSupported: false },
  { value: "family", label: "Families (validate only)", commitSupported: false },
  { value: "employee", label: "Employees (validate only)", commitSupported: false },
  { value: "course", label: "Courses (validate only)", commitSupported: false },
  { value: "section", label: "Sections (validate only)", commitSupported: false },
  { value: "attendance", label: "Attendance (validate only)", commitSupported: false },
  { value: "financial_transaction", label: "Financial Transactions", commitSupported: true },
  { value: "scholarship", label: "Scholarships (validate only)", commitSupported: false },
  { value: "state_funding", label: "State Funding (validate only)", commitSupported: false },
  { value: "quickbooks", label: "QuickBooks", commitSupported: true },
  { value: "historical", label: "Historical Data (validate only)", commitSupported: false },
];

export const MIGRATION_STEPS: Array<{ key: MigrationStep; label: string }> = [
  { key: "upload", label: "Upload" },
  { key: "mapping", label: "Mapping" },
  { key: "validation", label: "Validation" },
  { key: "preview", label: "Preview" },
  { key: "conflicts", label: "Conflicts" },
  { key: "import", label: "Import" },
  { key: "verification", label: "Verification" },
  { key: "report", label: "Report" },
];

export const EDP_AI_CAPABILITIES = [
  "suggest_mappings",
  "clean_imported_data",
  "detect_duplicates",
  "recommend_corrections",
  "identify_anomalies",
  "generate_migration_summaries",
] as const;

export const DEFAULT_STUDENT_MAPPINGS: FieldMapping[] = [
  { sourceField: "first_name", targetField: "first_name", required: true },
  { sourceField: "last_name", targetField: "last_name", required: true },
  { sourceField: "email", targetField: "email" },
  { sourceField: "grade_level", targetField: "grade_level" },
  { sourceField: "school_id", targetField: "school_id", required: true },
];

export const DEFAULT_QUICKBOOKS_MAPPINGS: FieldMapping[] = [
  { sourceField: "account_name", targetField: "account_name", required: true },
  { sourceField: "account_number", targetField: "account_number" },
  { sourceField: "amount", targetField: "amount", required: true },
  { sourceField: "date", targetField: "transaction_date", required: true },
];
