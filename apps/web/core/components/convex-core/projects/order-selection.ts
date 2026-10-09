/** Clear the previous section selection when switching projects or sections. */
export function clearProjectEntitySelection(current: URLSearchParams) {
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
  return next;
}

/** Reordering does not navigate; choosing another project starts at its personal default. */
export function selectOrderedProject(current: URLSearchParams, identifier: string) {
  const next = clearProjectEntitySelection(current);
  next.set("project", identifier);
  return next;
}
