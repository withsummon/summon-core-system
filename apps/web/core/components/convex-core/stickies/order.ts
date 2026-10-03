/** Descending order: do not move past the last loaded neighbor when more candidates exist. */
export function adjacentStickyOrder(
  rows: { sortOrder: number }[],
  index: number,
  direction: "up" | "down",
  hasMore: boolean
) {
  const neighbor = rows[index + (direction === "up" ? -1 : 1)];
  if (!neighbor) return null;
  if (direction === "up") {
    const before = rows[index - 2];
    if (!before) return neighbor.sortOrder + 10000;
    const order = (before.sortOrder + neighbor.sortOrder) / 2;
    return order > neighbor.sortOrder && order < before.sortOrder ? order : null;
  }
  const after = rows[index + 2];
  if (!after) return hasMore ? null : neighbor.sortOrder - 10000;
  const order = (neighbor.sortOrder + after.sortOrder) / 2;
  return order < neighbor.sortOrder && order > after.sortOrder ? order : null;
}
