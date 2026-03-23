import { ScheduledTasksPanel } from "@/components/features/scheduled-tasks/scheduled-tasks-panel";

export default function ScheduledTasksPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <ScheduledTasksPanel />
    </div>
  );
}
