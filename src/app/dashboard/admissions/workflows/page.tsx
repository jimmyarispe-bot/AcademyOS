import { PageHeader } from "@/components/ui/PageHeader";
import { WorkflowBuilder } from "@/components/admissions/WorkflowBuilder";
import { getWorkflowWithSteps, getWorkflows } from "@/lib/admissions/automation/queries";
import { getSchools } from "@/lib/admissions/queries";

interface WorkflowsPageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function WorkflowsPage({ searchParams }: WorkflowsPageProps) {
  const { id: selectedId } = await searchParams;
  const [workflows, schools] = await Promise.all([getWorkflows(), getSchools()]);

  const selectedWorkflow = selectedId
    ? workflows.find((w) => w.id === selectedId) ?? workflows[0] ?? null
    : workflows[0] ?? null;

  const { steps } = selectedWorkflow
    ? await getWorkflowWithSteps(selectedWorkflow.id)
    : { steps: [] };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Workflow Builder"
        subtitle="Configure triggers, conditions, actions, delays, and notifications — no code required"
        backHref="/dashboard/admissions/automation"
      />
      <WorkflowBuilder
        workflows={workflows}
        selectedWorkflow={selectedWorkflow}
        steps={steps}
        schools={schools}
      />
    </div>
  );
}
