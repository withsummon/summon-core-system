export function notificationTarget(
  workspace: string,
  project: string,
  task: string,
  comment?: string,
  destination: "task" | "intake" = "task"
) {
  const params = new URLSearchParams({ workspace, project, task, module: "projects", projectView: "tasks" });
  if (destination === "intake") {
    params.delete("task");
    params.set("projectView", "intake");
    params.set("intake", task);
  }
  if (comment) params.set("comment", comment);
  return params;
}
