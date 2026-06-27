interface StaffDirectoryPanelProps {
  entries: Array<{
    id: string;
    employee_type: string;
    schools: { name: string } | null;
    employee_profiles: {
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
      job_title: string | null;
      contact_email: string | null;
      contact_phone: string | null;
      photo_url: string | null;
      phone_extension: string | null;
      meet_link: string | null;
    } | null;
    employee_positions: Array<{
      is_primary: boolean;
      positions: { title: string; department: string | null } | null;
    }> | null;
  }>;
}

export function StaffDirectoryPanel({ entries }: StaffDirectoryPanelProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => {
        const profile = entry.employee_profiles;
        const primaryPosition = entry.employee_positions?.find((p) => p.is_primary)?.positions
          ?? entry.employee_positions?.[0]?.positions;
        const name =
          profile?.display_name ??
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ??
          "Staff member";

        return (
          <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
                {profile?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  name.charAt(0)
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{name}</h3>
                <p className="text-sm text-slate-600">
                  {profile?.job_title ?? primaryPosition?.title ?? entry.employee_type}
                </p>
                <p className="text-xs text-slate-500">
                  {entry.schools?.name}
                  {primaryPosition?.department ? ` · ${primaryPosition.department}` : ""}
                </p>
              </div>
            </div>
            <dl className="mt-4 space-y-1 text-sm text-slate-600">
              {profile?.contact_email && (
                <div>
                  <dt className="inline font-medium">Email: </dt>
                  <dd className="inline">{profile.contact_email}</dd>
                </div>
              )}
              {profile?.phone_extension && (
                <div>
                  <dt className="inline font-medium">Ext: </dt>
                  <dd className="inline">{profile.phone_extension}</dd>
                </div>
              )}
              {profile?.meet_link && (
                <div>
                  <a href={profile.meet_link} className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">
                    Join meeting
                  </a>
                </div>
              )}
            </dl>
          </article>
        );
      })}
      {entries.length === 0 && (
        <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No directory entries found.
        </p>
      )}
    </div>
  );
}
