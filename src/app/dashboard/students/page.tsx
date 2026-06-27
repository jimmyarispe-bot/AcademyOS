import { Suspense } from "react";
import { StudentsPageContent, StudentsPageSkeleton } from "./StudentsPageContent";

interface StudentsPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function StudentsPage({ searchParams }: StudentsPageProps) {
  return (
    <Suspense fallback={<StudentsPageSkeleton />}>
      <StudentsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
