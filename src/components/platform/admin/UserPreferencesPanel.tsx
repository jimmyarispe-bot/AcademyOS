"use client";

import { useTransition } from "react";
import { saveUserPreferencesAction } from "@/lib/platform/identity/server-actions";
import { DEFAULT_PREFERENCES } from "@/lib/platform/identity/preferences";
import type { UserPreferences } from "@/lib/platform/identity/types";

interface UserPreferencesPanelProps {
  preferences: UserPreferences | null;
}

export function UserPreferencesPanel({ preferences }: UserPreferencesPanelProps) {
  const [isPending, startTransition] = useTransition();
  const prefs = preferences ?? { user_id: "", ...DEFAULT_PREFERENCES };
  const notifications = (prefs.notifications ?? DEFAULT_PREFERENCES.notifications) as Record<string, boolean>;
  const widgets = (prefs.mission_control_widgets ?? DEFAULT_PREFERENCES.mission_control_widgets) as Record<string, boolean>;

  return (
    <form
      className="grid gap-6 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => {
          void saveUserPreferencesAction(fd);
        });
      }}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">General</h3>
        <label className="block text-sm">
          Time zone
          <input name="timezone" defaultValue={prefs.timezone} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Language
          <select name="language" defaultValue={prefs.language} className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </label>
        <label className="block text-sm">
          Theme
          <select name="theme" defaultValue={prefs.theme} className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
        {(
          [
            ["notify_email", "Email notifications", notifications.email],
            ["notify_sms", "SMS notifications", notifications.sms],
            ["notify_dashboard", "Dashboard alerts", notifications.dashboard],
          ] as const
        ).map(([name, label, checked]) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <input type="hidden" name={name} value={checked ? "true" : "false"} />
            <input type="checkbox" defaultChecked={checked} onChange={(e) => {
              const hidden = e.currentTarget.previousElementSibling as HTMLInputElement;
              hidden.value = e.currentTarget.checked ? "true" : "false";
            }} />
            {label}
          </label>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-900">Mission Control widgets</h3>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["mc_failed", "Failed automations", widgets.failedAutomations],
              ["mc_tasks", "Pending tasks", widgets.pendingTasks],
              ["mc_queue", "Queue status", widgets.queueStatus],
            ] as const
          ).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <input type="hidden" name={name} value={checked ? "true" : "false"} />
              <input type="checkbox" defaultChecked={checked} onChange={(e) => {
                const hidden = e.currentTarget.previousElementSibling as HTMLInputElement;
                hidden.value = e.currentTarget.checked ? "true" : "false";
              }} />
              {label}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save preferences
        </button>
      </div>
    </form>
  );
}
