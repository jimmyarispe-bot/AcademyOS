"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { ImpersonationBanner } from "@/components/platform/ImpersonationBanner";

interface DashboardShellProps {
  fullName: string;
  roleLabel: string;
  impersonation?: { targetName: string } | null;
  notifications?: Array<{
    id: string;
    title: string;
    body: string;
    lead_id: string | null;
    created_at: string;
    notification_type: string;
  }>;
  children: React.ReactNode;
}

export function DashboardShell({
  fullName,
  roleLabel,
  impersonation = null,
  notifications = [],
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {impersonation && <ImpersonationBanner targetName={impersonation.targetName} />}
        <TopNav
          fullName={fullName}
          roleLabel={roleLabel}
          notifications={notifications}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
