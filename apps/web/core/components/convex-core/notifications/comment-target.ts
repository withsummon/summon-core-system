export function notificationTarget(workspace: string, project: string, task: string, comment?: string) {
  const params = new URLSearchParams({ workspace, project, task, module: "projects", projectView: "tasks" });
  if (comment) params.set("comment", comment);
  return params;
}
