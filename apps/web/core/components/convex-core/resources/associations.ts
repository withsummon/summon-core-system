/** Keep the canonical current association selectable even beyond the first option page. */
export function associationOptions<T extends string>(
  rows: Array<{ id: T; name: string }>,
  currentId: T | null,
  currentName: string | null
) {
  return currentId && currentName !== null && !rows.some((row) => row.id === currentId)
    ? [{ id: currentId, name: currentName }, ...rows]
    : rows;
}
export function selectedAssociation<T extends string>(value: string, rows: Array<{ id: T }>): T | null {
  if (!value) return null;
  const selected = rows.find((row) => row.id === value);
  if (!selected) throw new Error("This association is no longer available.");
  return selected.id;
}
