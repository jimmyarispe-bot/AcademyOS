import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getPrompts } from "@/lib/intelligence-platform/prompt-registry";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { HistoryTable } from "@/components/intelligence-platform/AipPanels";
import { createPromptAction, publishPromptAction } from "@/lib/intelligence-platform/actions";
import { PROMPT_CATEGORIES } from "@/lib/intelligence-platform/types";

export default async function PromptsPage() {
  await requirePagePermission(["ai.prompts", "ai.manage", "ai.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const prompts = orgId ? await getPrompts(supabase, orgId) : [];

  return (
    <AipShell title="Prompt Registry" subtitle="Central prompt storage with versioning, approval, and rollback">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <form action={createPromptAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Name
              <input name="name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required />
            </label>
            <label className="block text-sm">
              Category
              <select name="category" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                {PROMPT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>
          <input type="hidden" name="prompt_key" value={`prompt-${Date.now()}`} />
          <input type="hidden" name="module" value="general" />
          <label className="block text-sm">
            Template
            <textarea name="template" rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" />
          </label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create prompt
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Registered prompts</h2>
        <HistoryTable
          rows={prompts}
          columns={[
            { key: "name", label: "Name" },
            { key: "category", label: "Category" },
            { key: "module", label: "Module" },
            { key: "status", label: "Status" },
            { key: "current_version", label: "Version" },
          ]}
        />
        {prompts.filter((p) => p.status === "draft").map((p) => (
          <form key={p.id} action={publishPromptAction} className="mt-2 inline-block mr-2">
            <input type="hidden" name="prompt_id" value={p.id} />
            <button type="submit" className="text-sm text-brand-600 hover:underline">Publish {p.name}</button>
          </form>
        ))}
      </section>
    </AipShell>
  );
}
