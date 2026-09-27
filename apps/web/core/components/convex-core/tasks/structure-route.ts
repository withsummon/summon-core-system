export function relatedTaskRoute(current: URLSearchParams, taskId: string, projectIdentifier: string) {
  const next = new URLSearchParams(current);
  next.delete("comment");
  next.delete("taskView");
  next.delete("projectView");
  next.set("task", taskId);
  next.set("module", "projects");
  next.set("project", projectIdentifier);
  return `?${next}`;
}
