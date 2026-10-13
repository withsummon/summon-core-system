/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TSummonRole } from "@plane/types";

/** Plane's stored workspace roles, highest first, with what each can do in Summon. */
export const ROLE_OPTIONS: { value: TSummonRole; label: string; description: string }[] = [
  { value: 20, label: "Admin", description: "Manages settings and people; sees deals, budgets, and reports." },
  { value: 15, label: "Member", description: "Works across projects, clients, and credentials. No deal values." },
  { value: 5, label: "Guest", description: "Sees only the projects they're added to." },
];

export function roleLabel(role: TSummonRole | null) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? "No role";
}

/** Error codes from the Summon users API (`plane/summon/views/access.py`). */
const ACCESS_ERRORS: Record<string, string> = {
  cannot_change_self: "You can't change your own access. Ask another admin.",
  not_admin: "You're no longer an admin of this workspace.",
  workspace_owner: "The workspace owner always stays an admin.",
  sole_project_admin: "They're the only admin of a project. Make someone else a project admin first.",
  already_member: "This person is already in the workspace.",
  deactivated_member: "This person was deactivated. Restore them from the list instead.",
  already_invited: "This email already has a pending invite.",
};

export function accessErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const { error_code: code, email } = error as { error_code?: string; email?: string[] };
    if (code && ACCESS_ERRORS[code]) return ACCESS_ERRORS[code];
    if (email?.[0]) return email[0];
  }
  return "Something went wrong. Try again in a moment.";
}
