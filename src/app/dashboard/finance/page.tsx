import { Suspense } from "react";
import { FinancePageContent, FinancePageSkeleton } from "./FinancePageContent";

interface FinancePageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function FinancePage({ searchParams }: FinancePageProps) {
  return (
    <Suspense fallback={<FinancePageSkeleton />}>
      <FinancePageContent searchParams={searchParams} />
    </Suspense>
  );
}
