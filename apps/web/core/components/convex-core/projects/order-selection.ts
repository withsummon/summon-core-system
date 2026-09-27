/** Selecting a different project resets entity-specific deep links; reordering never calls this. */
export function selectOrderedProject(current: URLSearchParams, identifier: string) {
  const next = new URLSearchParams(current);
  for (const key of [
    "task",
    "taskView",
    "comment",
    "cycle",
    "cycleView",
    "projectModule",
    "moduleView",
    "intake",
    "intakeStatus",
    "savedView",
    "savedViewTab",
  ])
    next.delete(key);
  next.delete("projectView");
  next.set("project", identifier);
  return next;
}
