import type { createAuthClient } from "@/lib/supabase/server-auth";
import { SETUP_WIZARD_STEPS, type SetupStepKey } from "@/lib/configuration/types";
import { saveConfigSection } from "@/lib/configuration/sections";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getSetupSession(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("config_setup_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "in_progress")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function startSetupSession(supabase: AuthClient, organizationId: string, userId?: string) {
  const existing = await getSetupSession(supabase, organizationId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("config_setup_sessions")
    .insert({
      organization_id: organizationId,
      current_step: "organization",
      started_by: userId ?? null,
    })
    .select("*")
    .single();

  if (error) return null;
  return data;
}

export async function advanceSetupStep(
  supabase: AuthClient,
  input: {
    sessionId: string;
    organizationId: string;
    currentStep: SetupStepKey;
    stepData?: Record<string, unknown>;
    userId?: string;
  }
) {
  const { data: session } = await supabase
    .from("config_setup_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session) return { error: "Session not found" };

  const completed = [...((session.steps_completed as string[]) ?? [])];
  if (!completed.includes(input.currentStep)) completed.push(input.currentStep);

  const draft = { ...((session.draft_config as Record<string, unknown>) ?? {}), [input.currentStep]: input.stepData ?? {} };

  const stepIndex = SETUP_WIZARD_STEPS.findIndex((s) => s.key === input.currentStep);
  const nextStep = SETUP_WIZARD_STEPS[stepIndex + 1]?.key ?? "launch";

  if (input.stepData && mapsStepToSection(input.currentStep)) {
    await saveConfigSection(supabase, {
      organizationId: input.organizationId,
      sectionKey: mapsStepToSection(input.currentStep)!,
      configData: input.stepData,
      userId: input.userId,
      changeSummary: `Setup wizard: ${input.currentStep}`,
    });
  }

  const status = input.currentStep === "launch" ? "completed" : "in_progress";

  await supabase
    .from("config_setup_sessions")
    .update({
      current_step: nextStep,
      steps_completed: completed,
      draft_config: draft,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", input.sessionId);

  return { nextStep, completed };
}

function mapsStepToSection(step: SetupStepKey) {
  const map: Partial<Record<SetupStepKey, import("@/lib/configuration/types").ConfigSectionKey>> = {
    organization: "organization",
    branding: "branding",
    admissions: "admissions",
    finance: "finance",
    communications: "communications",
    automation: "automation",
    compliance: "compliance",
    playbooks: "playbooks",
    mission_control: "mission_control",
    executive: "executive",
  };
  return map[step];
}

export function getSetupProgress(completed: string[]) {
  const total = SETUP_WIZARD_STEPS.length;
  const done = completed.length;
  return Math.round((done / total) * 100);
}
