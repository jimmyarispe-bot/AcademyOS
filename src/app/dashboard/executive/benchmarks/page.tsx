import { createAuthClient } from "@/lib/supabase/server-auth";
import { getSchoolBenchmarks } from "@/lib/executive/benchmarking";
import { BenchmarkingPanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveBenchmarksPage() {
  const supabase = await createAuthClient();
  const rows = await getSchoolBenchmarks(supabase, "enrollment");

  return <BenchmarkingPanel rows={rows} metric="enrollment" />;
}
