import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getLatestPerformanceMetrics, getLatestScalabilityTests } from "@/lib/certification/performance-engine";
import { CertShell } from "@/components/certification/CertNav";
import { CertTable } from "@/components/certification/CertPanels";

export default async function CertificationPerformancePage() {
  await requirePagePermission(["certification.view", "certification.admin"]);
  const supabase = await createAuthClient();
  const [metrics, scalability] = await Promise.all([
    getLatestPerformanceMetrics(supabase),
    getLatestScalabilityTests(supabase),
  ]);

  return (
    <CertShell title="Performance Certification" subtitle="Load times, latency, queues, automation, caching, and scalability simulation">
      <section>
        <h2 className="mb-2 font-semibold">Performance Metrics</h2>
        <CertTable rows={metrics} columns={[
          { key: "metric_name", label: "Metric" }, { key: "value_ms", label: "Value (ms)" },
          { key: "threshold_ms", label: "Threshold" }, { key: "status", label: "Status" }, { key: "recommendation", label: "Recommendation" },
        ]} />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Scalability Testing</h2>
        <CertTable rows={scalability} columns={[
          { key: "user_count", label: "Users" }, { key: "response_time_ms", label: "Response (ms)" },
          { key: "db_load_pct", label: "DB Load %" }, { key: "queue_load_pct", label: "Queue Load %" },
          { key: "memory_mb", label: "Memory (MB)" }, { key: "status", label: "Status" },
        ]} />
      </section>
    </CertShell>
  );
}
