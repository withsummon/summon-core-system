/** Keep current draft selections removable when a live directory stops returning them. */
export function retainedChoices<T extends string>(
  available: { id: T; label: string }[],
  saved: { id: T; name: string | null }[],
  selected: T[],
  unavailableLabel: string
) {
  const choices = new Map(available.map((choice) => [choice.id, choice]));
  for (const choice of saved) {
    if (!choices.has(choice.id)) choices.set(choice.id, { id: choice.id, label: choice.name ?? unavailableLabel });
  }
  for (const id of selected) {
    if (!choices.has(id)) choices.set(id, { id, label: unavailableLabel });
  }
  return [...choices.values()];
}
