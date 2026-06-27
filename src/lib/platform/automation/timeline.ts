import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { PlatformModule, TimelineEventType } from "@/lib/platform/automation/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface WriteTimelineEventInput {
  schoolId?: string | null;
  module: PlatformModule;
  entityType: string;
  entityId: string;
  eventType: TimelineEventType | string;
  title: string;
  body?: string;
  actorUserId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export async function writeTimelineEvent(
  supabase: AuthClient,
  input: WriteTimelineEventInput
) {
  await supabase.from("platform_timeline_events").insert({
    school_id: input.schoolId ?? null,
    module: input.module,
    entity_type: input.entityType,
    entity_id: input.entityId,
    event_type: input.eventType,
    title: input.title,
    body: input.body ?? "",
    actor_user_id: input.actorUserId ?? null,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
    metadata: input.metadata ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  });
}

export async function getEntityTimeline(
  supabase: AuthClient,
  module: PlatformModule,
  entityType: string,
  entityId: string,
  searchQuery?: string
) {
  const { data } = await supabase
    .from("platform_timeline_events")
    .select("*, users(full_name)")
    .eq("module", module)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("occurred_at", { ascending: false });

  let events = data ?? [];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    events = events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q)
    );
  }
  return events;
}

export async function searchTimelines(
  supabase: AuthClient,
  filters: {
    module?: PlatformModule;
    schoolId?: string;
    query?: string;
    limit?: number;
  }
) {
  let q = supabase
    .from("platform_timeline_events")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.module) q = q.eq("module", filters.module);
  if (filters.schoolId) q = q.eq("school_id", filters.schoolId);

  const { data } = await q;
  if (!filters.query) return data ?? [];

  const needle = filters.query.toLowerCase();
  return (data ?? []).filter(
    (e) =>
      e.title.toLowerCase().includes(needle) || e.body.toLowerCase().includes(needle)
  );
}
