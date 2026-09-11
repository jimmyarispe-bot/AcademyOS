import type {
  FormCondition,
  FormConditionGroup,
  FormConditionOperator,
  FormValues,
} from "@/lib/platform/forms/types";

function isGroup(
  node: FormCondition | FormConditionGroup
): node is FormConditionGroup {
  return "all" in node || "any" in node;
}

export function getValueAtPath(values: FormValues, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = values;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function compare(
  op: FormConditionOperator,
  left: unknown,
  right: unknown
): boolean {
  switch (op) {
    case "exists":
      return left !== undefined && left !== null && left !== "";
    case "empty":
      return left === undefined || left === null || left === "";
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case "in":
      return Array.isArray(right) && right.includes(left);
    case "contains":
      // Compared as strings: a multiselect answer arrives from FormData as
      // string values, while a condition may carry a number or a boolean.
      return (
        Array.isArray(left) && left.some((entry) => String(entry) === String(right))
      );
    default:
      return false;
  }
}

export function evaluateFormCondition(
  condition: FormCondition,
  values: FormValues
): boolean {
  return compare(
    condition.op,
    getValueAtPath(values, condition.path),
    condition.value
  );
}

/** Deterministic declarative visibility rules. */
export function evaluateFormConditions(
  group: FormConditionGroup | undefined,
  values: FormValues
): boolean {
  if (!group) return true;
  const all = group.all ?? [];
  const any = group.any ?? [];
  if (all.length === 0 && any.length === 0) return true;

  const allOk =
    all.length === 0 ||
    all.every((node) =>
      isGroup(node)
        ? evaluateFormConditions(node, values)
        : evaluateFormCondition(node, values)
    );
  const anyOk =
    any.length === 0 ||
    any.some((node) =>
      isGroup(node)
        ? evaluateFormConditions(node, values)
        : evaluateFormCondition(node, values)
    );

  if (all.length > 0 && any.length > 0) return allOk && anyOk;
  if (all.length > 0) return allOk;
  return anyOk;
}
