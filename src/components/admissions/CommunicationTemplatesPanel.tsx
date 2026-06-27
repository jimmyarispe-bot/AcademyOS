"use client";

import { useTransition } from "react";
import { saveTemplateWithVersion } from "@/lib/admissions/automation/server-actions";
import {
  CHANNEL_LABELS,
  MERGE_FIELDS,
  TRIGGER_EVENT_LABELS,
  type CommunicationTemplate,
} from "@/lib/admissions/communications/types";

interface CommunicationTemplatesPanelProps {
  templates: CommunicationTemplate[];
}

export function CommunicationTemplatesPanel({ templates }: CommunicationTemplatesPanelProps) {
  const [isPending, startTransition] = useTransition();

  const grouped = templates.reduce<Record<string, CommunicationTemplate[]>>((acc, t) => {
    if (!acc[t.trigger_event]) acc[t.trigger_event] = [];
    acc[t.trigger_event].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">Merge Fields</h3>
        <p className="mt-1 text-xs text-slate-500">
          Use double curly braces in templates, e.g. {"{{student_name}}"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MERGE_FIELDS.map((field) => (
            <code
              key={field}
              className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
            >
              {`{{${field}}}`}
            </code>
          ))}
        </div>
      </div>

      {Object.entries(grouped).map(([triggerEvent, items]) => (
        <section key={triggerEvent} className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {TRIGGER_EVENT_LABELS[triggerEvent as keyof typeof TRIGGER_EVENT_LABELS] ?? triggerEvent}
          </h2>
          {items.map((template) => (
            <form
              key={template.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4"
              action={(fd) => {
                startTransition(async () => {
                  fd.set("id", template.id);
                  await saveTemplateWithVersion(fd);
                });
              }}
            >
              <input type="hidden" name="id" value={template.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{template.name}</p>
                  <p className="text-xs text-slate-500">
                    {CHANNEL_LABELS[template.channel]} · {template.template_key}
                    · v{template.version_number ?? 1}
                    · {(template as { category?: string }).category ?? "general"}
                    {template.delay_hours > 0 ? ` · delay ${template.delay_hours}h` : ""}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={template.is_active}
                    value="true"
                  />
                  Active
                </label>
              </div>
              <input
                name="name"
                defaultValue={template.name}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                name="subject"
                defaultValue={template.subject}
                placeholder="Subject"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                name="category"
                defaultValue={template.category ?? "general"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {["inquiry", "tour", "application", "funding", "financial_aid", "interview", "acceptance", "waitlist", "denial", "enrollment", "emergency", "general"].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <textarea
                name="body"
                defaultValue={template.body}
                rows={6}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
              <input
                name="change_notes"
                placeholder="Version change notes (optional)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">
                  Delay (hours)
                  <input
                    name="delay_hours"
                    type="number"
                    min={0}
                    defaultValue={template.delay_hours}
                    className="ml-2 w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Save template
                </button>
              </div>
            </form>
          ))}
        </section>
      ))}
    </div>
  );
}
