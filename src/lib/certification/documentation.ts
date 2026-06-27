import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const V1_GUIDES = [
  { key: "administrator_guide", title: "Administrator Guide", category: "administrator", sections: ["Organization setup", "User management", "Configuration Studio", "Go Live", "Security"] },
  { key: "teacher_guide", title: "Teacher Guide", category: "teacher", sections: ["Teacher workspace", "Attendance", "Assessments", "Parent communication"] },
  { key: "parent_guide", title: "Parent Guide", category: "parent", sections: ["Portal access", "Finance", "Documents", "Messaging", "Student progress"] },
  { key: "finance_guide", title: "Finance Guide", category: "finance", sections: ["Tuition", "Scholarships", "State funding", "Payroll", "Board reports"] },
  { key: "hr_guide", title: "HR Guide", category: "hr", sections: ["Employees", "Compliance", "Payroll integration", "Workforce analytics"] },
  { key: "admissions_guide", title: "Admissions Guide", category: "admissions", sections: ["Lead pipeline", "Applications", "Funding programs", "Enrollment workflows"] },
  { key: "executive_guide", title: "Executive Guide", category: "executive", sections: ["Executive dashboard", "KPIs", "Board reports", "Decision intelligence", "Mission Control"] },
  { key: "developer_guide", title: "Developer Guide", category: "developer", sections: ["API keys", "Webhooks", "Event bus", "SDK", "Integration Hub"] },
  { key: "api_documentation", title: "API Documentation", category: "api", sections: ["Authentication", "REST endpoints", "Rate limits", "OpenAPI"] },
  { key: "implementation_guide", title: "Implementation Guide", category: "implementation", sections: ["Discovery", "Configuration", "Data migration", "Training", "Go-live"] },
  { key: "student_guide", title: "Student Guide", category: "student", sections: ["Student portal", "Schedule", "Goals", "Portfolio"] },
  { key: "support_guide", title: "Support Guide", category: "support", sections: ["Support tiers", "Escalation", "Knowledge base"] },
  { key: "changelog", title: "AcademyOS v1.0 Change Log", category: "changelog", sections: ["Release 1-16 feature summary", "Breaking changes", "Migration notes"] },
];

function buildMarkdown(guide: (typeof V1_GUIDES)[number]) {
  const body = guide.sections.map((s) => `## ${s}\n\nContent for ${s} in AcademyOS Version 1.0 Enterprise.\n`).join("\n");
  return `# ${guide.title}\n\nAcademyOS Version 1.0 Enterprise — auto-generated launch documentation.\n\n${body}`;
}

export async function getDocumentation(supabase: AuthClient, category?: string) {
  let query = supabase.from("cert_documentation").select("*").order("doc_title");
  if (category) query = query.eq("doc_category", category);
  const { data } = await query;
  return data ?? [];
}

export async function getDocumentationByKey(supabase: AuthClient, docKey: string) {
  const { data } = await supabase.from("cert_documentation").select("*").eq("doc_key", docKey).maybeSingle();
  return data;
}

export async function regenerateDocumentation(supabase: AuthClient) {
  for (const g of V1_GUIDES) {
    await supabase.from("cert_documentation").upsert({
      doc_key: g.key,
      doc_title: g.title,
      doc_category: g.category,
      content_md: buildMarkdown(g),
      auto_generated: true,
    }, { onConflict: "doc_key" });
  }

  return { regenerated: V1_GUIDES.length };
}
