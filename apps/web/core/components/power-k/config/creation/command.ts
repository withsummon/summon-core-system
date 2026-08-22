/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Briefcase, FileText, FolderPlus, Layers, SquarePlus } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { ContrastIcon, DiceIcon, LayersIcon } from "@plane/propel/icons";
// components
import { EUserProjectRoles } from "@plane/types";
import type { TPowerKCommandConfig, TPowerKContext } from "@/components/power-k/core/types";
import { handlePowerKNavigate } from "@/components/power-k/utils/navigation";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";
import { useInstance } from "@/hooks/store/use-instance";

export type TPowerKCreationCommandKeys =
  | "create_work_item"
  | "create_page"
  | "create_view"
  | "create_cycle"
  | "create_module"
  | "create_project"
  | "create_workspace"
  | "create_summon_client"
  | "create_summon_opportunity"
  | "create_summon_meeting"
  | "open_summon_automation";

/**
 * Creation commands - Create any entity in the app
 */
export const usePowerKCreationCommandsRecord = (): Record<TPowerKCreationCommandKeys, TPowerKCommandConfig> => {
  // store
  const { config } = useInstance();
  const {
    canPerformAnyCreateAction,
    permission: { allowPermissions },
  } = useUser();
  const { workspaceProjectIds, getPartialProjectById } = useProject();
  const {
    toggleCreateIssueModal,
    toggleCreateProjectModal,
    toggleCreateCycleModal,
    toggleCreateModuleModal,
    toggleCreateViewModal,
    toggleCreatePageModal,
  } = useCommandPalette();
  // derived values
  const canCreateWorkItem = canPerformAnyCreateAction && workspaceProjectIds && workspaceProjectIds.length > 0;
  const canCreateProject = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const hasProjectMemberLevelPermissions = (ctx: TPowerKContext) =>
    allowPermissions(
      [EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER],
      EUserPermissionsLevel.PROJECT,
      ctx.params.workspaceSlug?.toString(),
      ctx.params.projectId?.toString()
    );
  const hasWorkspaceMemberLevelPermissions = (ctx: TPowerKContext) =>
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.WORKSPACE,
      ctx.params.workspaceSlug?.toString()
    );
  const isWorkspaceCreationDisabled = config?.is_workspace_creation_disabled ?? false;

  const getProjectDetails = (ctx: TPowerKContext) =>
    ctx.params.projectId ? getPartialProjectById(ctx.params.projectId.toString()) : undefined;

  return {
    create_work_item: {
      id: "create_work_item",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_work_item",
      icon: LayersIcon,
      keySequence: "ni",
      action: () => toggleCreateIssueModal(true),
      isEnabled: () => Boolean(canCreateWorkItem),
      isVisible: () => Boolean(canCreateWorkItem),
      closeOnSelect: true,
    },
    create_page: {
      id: "create_page",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_page",
      icon: FileText,
      keySequence: "nd",
      action: () => toggleCreatePageModal({ isOpen: true }),
      isEnabled: (ctx) => Boolean(getProjectDetails(ctx)?.page_view && hasProjectMemberLevelPermissions(ctx)),
      isVisible: (ctx) =>
        Boolean(ctx.params.projectId && getProjectDetails(ctx)?.page_view && hasProjectMemberLevelPermissions(ctx)),
      closeOnSelect: true,
    },
    create_view: {
      id: "create_view",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_view",
      icon: Layers,
      keySequence: "nv",
      action: () => toggleCreateViewModal(true),
      isEnabled: (ctx) => Boolean(getProjectDetails(ctx)?.issue_views_view && hasProjectMemberLevelPermissions(ctx)),
      isVisible: (ctx) =>
        Boolean(
          ctx.params.projectId && getProjectDetails(ctx)?.issue_views_view && hasProjectMemberLevelPermissions(ctx)
        ),
      closeOnSelect: true,
    },
    create_cycle: {
      id: "create_cycle",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_cycle",
      icon: ContrastIcon,
      keySequence: "nc",
      action: () => toggleCreateCycleModal(true),
      isEnabled: (ctx) => Boolean(getProjectDetails(ctx)?.cycle_view && hasProjectMemberLevelPermissions(ctx)),
      isVisible: (ctx) =>
        Boolean(ctx.params.projectId && getProjectDetails(ctx)?.cycle_view && hasProjectMemberLevelPermissions(ctx)),
      closeOnSelect: true,
    },
    create_module: {
      id: "create_module",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_module",
      icon: DiceIcon,
      keySequence: "nm",
      action: () => toggleCreateModuleModal(true),
      isEnabled: (ctx) => Boolean(getProjectDetails(ctx)?.module_view && hasProjectMemberLevelPermissions(ctx)),
      isVisible: (ctx) =>
        Boolean(ctx.params.projectId && getProjectDetails(ctx)?.module_view && hasProjectMemberLevelPermissions(ctx)),
      closeOnSelect: true,
    },
    create_project: {
      id: "create_project",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_project",
      icon: FolderPlus,
      keySequence: "np",
      action: () => toggleCreateProjectModal(true),
      isEnabled: () => Boolean(canCreateProject),
      isVisible: () => Boolean(canCreateProject),
      closeOnSelect: true,
    },
    create_workspace: {
      id: "create_workspace",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_workspace",
      icon: SquarePlus,
      action: (ctx) => ctx.router.push("/create-workspace"),
      isEnabled: () => Boolean(!isWorkspaceCreationDisabled),
      isVisible: () => Boolean(!isWorkspaceCreationDisabled),
      closeOnSelect: true,
    },
    create_summon_client: {
      id: "create_summon_client",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_summon_client",
      icon: Briefcase,
      action: (ctx) => handlePowerKNavigate(ctx, [ctx.params.workspaceSlug?.toString(), "summon", "clients"]),
      isEnabled: (ctx) => hasWorkspaceMemberLevelPermissions(ctx),
      isVisible: (ctx) => hasWorkspaceMemberLevelPermissions(ctx),
      closeOnSelect: true,
    },
    create_summon_opportunity: {
      id: "create_summon_opportunity",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_summon_opportunity",
      icon: Layers,
      action: (ctx) => handlePowerKNavigate(ctx, [ctx.params.workspaceSlug?.toString(), "summon", "opportunities"]),
      isEnabled: (ctx) => hasWorkspaceMemberLevelPermissions(ctx),
      isVisible: (ctx) => hasWorkspaceMemberLevelPermissions(ctx),
      closeOnSelect: true,
    },
    create_summon_meeting: {
      id: "create_summon_meeting",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.create_summon_meeting",
      icon: Layers,
      action: (ctx) => handlePowerKNavigate(ctx, [ctx.params.workspaceSlug?.toString(), "summon", "meetings"]),
      isEnabled: (ctx) => hasWorkspaceMemberLevelPermissions(ctx),
      isVisible: (ctx) => hasWorkspaceMemberLevelPermissions(ctx),
      closeOnSelect: true,
    },
    open_summon_automation: {
      id: "open_summon_automation",
      type: "action",
      group: "create",
      i18n_title: "power_k.creation_actions.open_summon_automation",
      icon: DiceIcon,
      action: (ctx) => handlePowerKNavigate(ctx, [ctx.params.workspaceSlug?.toString(), "summon", "automation"]),
      isEnabled: (ctx) => hasWorkspaceMemberLevelPermissions(ctx),
      isVisible: (ctx) => hasWorkspaceMemberLevelPermissions(ctx),
      closeOnSelect: true,
    },
  };
};
