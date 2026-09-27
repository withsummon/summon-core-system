// Pure presentation input: callers can supply a stored user or an authorized
// directory projection without introducing a generated-API inference cycle.
export function memberLabel(member: { id: string; name?: string | null; email?: string | null } | null) {
  return member ? member.name || member.email || `Member …${member.id.slice(-6)}` : "Unavailable member";
}
