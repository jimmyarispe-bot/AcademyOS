import { Suspense } from "react";
import { WorkPageContent, WorkPageSkeleton } from "./WorkPageContent";

interface WorkPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function WorkPage({ searchParams }: WorkPageProps) {
  return (
    <Suspense fallback={<WorkPageSkeleton />}>
      <WorkPageContent searchParams={searchParams} />
    </Suspense>
  );
}
