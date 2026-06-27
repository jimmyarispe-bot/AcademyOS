import type { WorkflowContext } from "@/lib/admissions/automation/context";
import type { WorkflowStep } from "@/lib/admissions/automation/types";

type ConditionOperator = "equals" | "not_equals" | "contains" | "exists" | "not_exists";

interface ConditionConfig {
  field?: string;
  operator?: ConditionOperator;
  value?: string | boolean | number;
}

function getFieldValue(ctx: WorkflowContext, field: string): unknown {
  switch (field) {
    case "lead_stage":
      return ctx.leadStage;
    case "application_status":
      return ctx.applicationStatus;
    case "has_application":
      return ctx.applicationId != null;
    case "has_missing_items":
      return (ctx.mergeContext.missingItems?.length ?? 0) > 0;
    case "assigned_to":
      return ctx.assignedToUserId;
    default:
      return ctx.metadata[field];
  }
}

export function evaluateCondition(
  ctx: WorkflowContext,
  config: Record<string, unknown>
): boolean {
  const { field, operator = "equals", value } = config as ConditionConfig;
  if (!field) return true;

  const actual = getFieldValue(ctx, field);

  switch (operator) {
    case "equals":
      return String(actual) === String(value);
    case "not_equals":
      return String(actual) !== String(value);
    case "contains":
      return String(actual).includes(String(value));
    case "exists":
      return actual != null && actual !== "";
    case "not_exists":
      return actual == null || actual === "";
    default:
      return true;
  }
}

export function evaluateStepConditions(
  ctx: WorkflowContext,
  step: WorkflowStep
): boolean {
  if (step.step_type !== "condition") return true;
  return evaluateCondition(ctx, step.config);
}
