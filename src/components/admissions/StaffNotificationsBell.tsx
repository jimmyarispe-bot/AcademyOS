"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markStaffNotificationRead } from "@/lib/admissions/communications/actions";

interface StaffNotification {
  id: string;
  title: string;
  body: string;
  lead_id: string | null;
  created_at: string;
  notification_type: string;
}

interface StaffNotificationsBellProps {
  notifications: StaffNotification[];
}

export function StaffNotificationsBell({ notifications }: StaffNotificationsBellProps) {
  const [isPending, startTransition] = useTransition();
  const unread = notifications.filter((n) => !("read_at" in n && n.read_at));

  if (notifications.length === 0) return null;

  return (
    <div className="relative">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <span aria-hidden>🔔</span>
          {unread.length > 0 && (
            <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-xs text-white">
              {unread.length}
            </span>
          )}
        </summary>
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-96 overflow-y-auto p-2">
            {notifications.map((n) => (
              <div key={n.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-900">{n.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{n.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                  <div className="flex gap-2">
                    {n.lead_id && (
                      <Link
                        href={`/dashboard/admissions/leads/${n.lead_id}`}
                        className="text-xs font-medium text-brand-600"
                      >
                        View lead
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await markStaffNotificationRead(n.id);
                        })
                      }
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Mark read
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
