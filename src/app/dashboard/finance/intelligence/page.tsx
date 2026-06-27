import { Suspense } from "react";
import { IntelligencePageContent, IntelligencePageSkeleton } from "./IntelligencePageContent";

interface IntelligencePageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function FinancialIntelligencePage({ searchParams }: IntelligencePageProps) {
  return (
    <Suspense fallback={<IntelligencePageSkeleton />}>
      <IntelligencePageContent searchParams={searchParams} />
    </Suspense>
  );
}
