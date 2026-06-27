"use client";

import { useTransition } from "react";
import { markNotificationReadAction } from "@/lib/portal/actions";

interface PortalNotificationsListProps {
  notifications: {
    id: string;
    title: string;
    body: string;
    category: string;
    href: string | null;
    is_read: boolean;
    created_at: string;
  }[];
}

export function PortalNotificationsList({ notifications }: PortalNotificationsListProps) {
  const [pending, startTransition] = useTransition();

  return (
    <ul className="space-y-2">
      {notifications.map((n) => (
        <li key={n.id} className={`rounded-xl border px-4 py-3 text-sm ${n.is_read ? "border-slate-100 bg-white" : "border-brand-200 bg-brand-50/40"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{n.title}</p>
              <p className="mt-1 text-slate-600">{n.body}</p>
              <p className="mt-1 text-xs capitalize text-slate-400">{n.category.replace(/_/g, " ")} · {new Date(n.created_at).toLocaleString()}</p>
            </div>
            {!n.is_read && (
              <button
                type="button"
                disabled={pending}
                className="text-xs text-brand-600"
                onClick={() => startTransition(async () => {
                  const fd = new FormData();
                  fd.set("notification_id", n.id);
                  await markNotificationReadAction(fd);
                })}
              >
                Mark read
              </button>
            )}
          </div>
          {n.href && <a href={n.href} className="mt-2 inline-block text-xs text-brand-600 hover:underline">View →</a>}
        </li>
      ))}
      {!notifications.length && <li className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No notifications yet.</li>}
    </ul>
  );
}
