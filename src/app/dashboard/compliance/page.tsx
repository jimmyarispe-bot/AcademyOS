import { Suspense } from "react";
import { CompliancePageContent, CompliancePageSkeleton } from "./CompliancePageContent";

interface CompliancePageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function CompliancePage({ searchParams }: CompliancePageProps) {
  return (
    <Suspense fallback={<CompliancePageSkeleton />}>
      <CompliancePageContent searchParams={searchParams} />
    </Suspense>
  );
}
