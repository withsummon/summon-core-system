/** A saved-view result opens the task's own project, independent of the originating view scope. */
export function savedViewTaskLink(params: URLSearchParams, projectIdentifier: string, taskId: string) {
  const next = new URLSearchParams(params);
  next.set("module", "projects");
  next.set("project", projectIdentifier);
  next.set("task", taskId);
  for (const key of [
    "projectView",
    "savedView",
    "savedViewTab",
    "taskView",
    "cycle",
    "cycleView",
    "projectModule",
    "moduleView",
    "intake",
    "intakeStatus",
  ])
    next.delete(key);
  return `?${next}`;
}
