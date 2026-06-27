import { Suspense } from "react";
import { HrPageContent, HrPageSkeleton } from "./HrPageContent";

interface HrPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function HrPage({ searchParams }: HrPageProps) {
  return (
    <Suspense fallback={<HrPageSkeleton />}>
      <HrPageContent searchParams={searchParams} />
    </Suspense>
  );
}
