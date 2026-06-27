import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { FamilyFinancialCenter } from "@/components/finance/FamilyFinancialCenter";
import { getFamilyFinancialProfile } from "@/lib/finance/family-center";
import { createAuthClient } from "@/lib/supabase/server-auth";

interface FamilyFinancePageProps {
  params: Promise<{ id: string }>;
}

export default async function FamilyFinancePage({ params }: FamilyFinancePageProps) {
  const { id } = await params;
  const supabase = await createAuthClient();
  const profile = await getFamilyFinancialProfile(supabase, id);
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/dashboard/finance?view=families" className="text-sm text-slate-500 hover:text-brand-600">← Finance</Link>
      <PageHeader
        title={profile.family.family_name}
        subtitle="Family Financial Center — payers, balances, payment plans, and credits"
      />
      <FamilyFinancialCenter familyId={id} profile={profile as Parameters<typeof FamilyFinancialCenter>[0]["profile"]} />
    </div>
  );
}
