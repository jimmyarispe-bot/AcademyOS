import { createAuthClient } from "@/lib/supabase/server-auth";
import {
  aggregateFundingReporting,
  fetchStudentFundingCodesByStudentIds,
} from "@/lib/funding/sync";

export interface TuitionPlan {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  program: string | null;
  annual_amount: number;
  payment_schedule: string;
  status: string;
  schools?: { name: string } | null;
}

export interface BillingAccount {
  id: string;
  family_id: string;
  school_id: string;
  account_status: string;
  balance: number;
  credit_balance?: number;
  collections_status?: string;
  autopay_enabled?: boolean;
  sibling_discount_student_id: string | null;
  sibling_discount_percent: number;
  families?: { family_name: string } | null;
}

export interface Invoice {
  id: string;
  billing_account_id: string;
  student_id: string | null;
  invoice_number: string;
  description: string | null;
  subtotal: number;
  sibling_discount_amount: number;
  total_amount: number;
  amount_paid: number;
  due_date: string;
  invoice_status: string;
  family_billing_accounts?: {
    families?: { family_name: string } | null;
  } | null;
  students?: {
    first_name: string;
    last_name: string;
    funding_sources: string[];
  } | null;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  reference_number: string | null;
}

export interface StudentBillingRow {
  id: string;
  first_name: string;
  last_name: string;
  family_id: string | null;
  funding_sources: string[];
}

export async function getTuitionPlans() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("tuition_plans")
    .select("*, schools(name)")
    .eq("status", "active")
    .order("name");

  return (data ?? []) as TuitionPlan[];
}

export async function getBillingAccounts() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("family_billing_accounts")
    .select("*, families(family_name)")
    .order("created_at", { ascending: false });

  return (data ?? []) as BillingAccount[];
}

export async function getInvoices() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("invoices")
    .select(`
      *,
      family_billing_accounts(families(family_name)),
      students(first_name, last_name)
    `)
    .order("due_date", { ascending: false });

  const rows = (data ?? []) as Array<
    Omit<Invoice, "students"> & {
      students: { first_name: string; last_name: string } | null;
      student_id: string | null;
    }
  >;

  const studentIds = [
    ...new Set(rows.map((row) => row.student_id).filter((id): id is string => Boolean(id))),
  ];
  const fundingByStudentId = await fetchStudentFundingCodesByStudentIds(supabase, studentIds);

  return rows.map((row) => ({
    ...row,
    students: row.students
      ? {
          ...row.students,
          funding_sources: row.student_id
            ? (fundingByStudentId.get(row.student_id) ?? [])
            : [],
        }
      : null,
  })) as Invoice[];
}

export async function getPayments() {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .order("paid_at", { ascending: false })
    .limit(50);

  return (data ?? []) as Payment[];
}

export async function getFinanceStats() {
  const [invoices, payments, reporting] = await Promise.all([
    getInvoices(),
    getPayments(),
    getFinanceReporting(),
  ]);

  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = invoices
    .filter((i) => !["paid", "void"].includes(i.invoice_status))
    .reduce((sum, i) => sum + Number(i.total_amount) - Number(i.amount_paid), 0);

  return {
    totalBilled,
    totalPaid,
    outstanding,
    invoiceCount: invoices.length,
    overdueCount: invoices.filter(
      (i) =>
        i.invoice_status === "overdue" ||
        (i.invoice_status === "sent" && i.due_date < new Date().toISOString().split("T")[0])
    ).length,
    byFunding: reporting.byFunding,
    byCategory: reporting.byCategory,
  };
}

export async function getFinanceReporting() {
  const students = await getStudentsForBilling();
  const fundingReport = aggregateFundingReporting(
    students.map((student) => ({ funding_sources: student.funding_sources }))
  );
  return {
    byFunding: fundingReport.byFunding,
    byCategory: fundingReport.byCategory,
    students,
  };
}

export async function getFamiliesForBilling() {
  const supabase = await createAuthClient();
  const { data } = await supabase.from("families").select("id, family_name, school_id").order("family_name");
  return data ?? [];
}

export async function getStudentsForBilling(): Promise<StudentBillingRow[]> {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("students")
    .select("id, first_name, last_name, family_id")
    .order("last_name");

  const rows = data ?? [];
  const fundingByStudentId = await fetchStudentFundingCodesByStudentIds(
    supabase,
    rows.map((row) => row.id)
  );

  return rows.map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    family_id: row.family_id,
    funding_sources: fundingByStudentId.get(row.id) ?? [],
  }));
}

export async function getSchools() {
  const supabase = await createAuthClient();
  const { data } = await supabase.from("schools").select("id, name").order("name");
  return data ?? [];
}
