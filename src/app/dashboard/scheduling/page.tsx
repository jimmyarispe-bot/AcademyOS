import { Suspense } from "react";
import { SchedulingPageContent, SchedulingPageSkeleton } from "./SchedulingPageContent";

interface SchedulingPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function SchedulingPage({ searchParams }: SchedulingPageProps) {
  return (
    <Suspense fallback={<SchedulingPageSkeleton />}>
      <SchedulingPageContent searchParams={searchParams} />
    </Suspense>
  );
}
