import { Suspense } from "react";
import { TeacherPageContent, TeacherPageSkeleton } from "./TeacherPageContent";

interface TeacherPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function TeacherPage({ searchParams }: TeacherPageProps) {
  return (
    <Suspense fallback={<TeacherPageSkeleton />}>
      <TeacherPageContent searchParams={searchParams} />
    </Suspense>
  );
}
