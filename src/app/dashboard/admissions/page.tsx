import { Suspense } from "react";
import { AdmissionsPageContent, AdmissionsPageSkeleton } from "./AdmissionsPageContent";

interface AdmissionsPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default function AdmissionsPage({ searchParams }: AdmissionsPageProps) {
  return (
    <Suspense fallback={<AdmissionsPageSkeleton />}>
      <AdmissionsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
