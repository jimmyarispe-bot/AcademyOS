import type { DashboardModule, ModuleId } from "@/lib/dashboard/navigation";

/**
 * Which permission opens each module in the sidebar.
 *
 * THE BUG THIS CLOSES. The Modules list rendered every entry to every signed-in
 * person, with no permission check anywhere. A School Leader whose whole remit
 * is admissions saw Scholarships, Finance and Workforce sitting in her sidebar.
 * Clicking one bounced her off the layout guard, so she could not read the
 * numbers — but she could see that the money exists, who it belongs to as a
 * heading, and that the JAG has a Finance module she is being kept out of.
 *
 * "Never see anything about money" means the word does not appear on her screen,
 * not that the page refuses her after she clicks it. A guard that only fires on
 * arrival is a lock on a door with the contents listed on the outside.
 *
 * HOW IT WORKS. Each module names the permissions that reveal it; holding any
 * one is enough. A module absent from this map is visible to everyone, which is
 * the right default for Calendar and Documents and the wrong default for money —
 * so the money modules are all named here explicitly, and the test alongside
 * this file fails if a new one is added without an entry.
 *
 * THIS IS NOT THE SECURITY BOUNDARY. Row-level security is, and the layout
 * guards behind it. This decides what a person is shown. Both matter and they
 * are not the same job: hiding without guarding is theatre, guarding without
 * hiding is what we had.
 */
export const MODULE_REQUIRED_PERMISSIONS: Partial<Record<ModuleId, readonly string[]>> = {
  admissions: ["admissions.view", "admissions.manage", "admissions.accept"],
  students: ["students.view", "students.edit"],
  scholarships: ["scholarships.view", "scholarships.approve"],
  finance: ["finance.view", "FINANCE_ACCESS", "finance.billing", "finance.executive"],
  hr: ["hr.view", "hr.manage", "HR_ACCESS"],
  "school-leader": [
    "school.configure",
    "students.view",
    "admissions.view",
    "executive.dashboard",
  ],
  teacher: ["teacher.view", "teacher.manage", "TEACHER_ACCESS"],
  scheduling: ["scheduling.view", "scheduling.manage", "scheduling.executive"],
};

/**
 * The modules this person may see.
 *
 * An unmapped module is shown. An empty permission list from the caller hides
 * every mapped module rather than showing them — a page that could not work out
 * who you are should not conclude you may see the money.
 */
export function visibleModules(
  modules: readonly DashboardModule[],
  permissions: readonly string[]
): DashboardModule[] {
  const granted = new Set(permissions);
  return modules.filter((module) => {
    const required = MODULE_REQUIRED_PERMISSIONS[module.id];
    if (!required) return true;
    return required.some((key) => granted.has(key));
  });
}
