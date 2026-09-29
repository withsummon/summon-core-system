/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
// i18n
import { EUserPermissions, EUserPermissionsLevel, PROJECT_TRACKER_ELEMENTS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// ui
import { Button } from "@plane/propel/button";
import { ProjectIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header, CustomMenu, Row } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useUserPermissions } from "@/hooks/store/user";
// plane web constants
// components
import HeaderFilters from "./filters";
import { ProjectSearch, ProjectSearchView } from "./search-projects";

export const ProjectsBaseHeader = observer(function ProjectsBaseHeader() {
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { toggleCreateProjectModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();

  const pathname = usePathname();
  // auth
  const isAuthorizedUser = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const isArchived = pathname.includes("/archives");

  return (
    <ProjectsBaseHeaderView
      section={isArchived ? "archived" : "active"}
      search={<ProjectSearch />}
      filters={<HeaderFilters />}
      create={
        isAuthorizedUser && !isArchived ? (
          <Button
            variant="primary"
            size="lg"
            onClick={() => toggleCreateProjectModal(true)}
            data-ph-element={PROJECT_TRACKER_ELEMENTS.CREATE_HEADER_BUTTON}
            className="items-center gap-1"
          >
            <span className="hidden sm:inline-block">{t("workspace_projects.create.label")}</span>
            <span className="inline-block sm:hidden">{t("workspace_projects.label", { count: 1 })}</span>
          </Button>
        ) : null
      }
    />
  );
});

export function ProjectsBaseHeaderView({
  section,
  search,
  filters,
  create,
  navigation,
}: {
  section: "active" | "archived" | "trash";
  search: ReactNode;
  filters: ReactNode;
  create?: ReactNode;
  navigation?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={t("workspace_projects.label", { count: 2 })}
                icon={<ProjectIcon className="h-4 w-4 text-tertiary" />}
              />
            }
          />
          {section !== "active" && (
            <Breadcrumbs.Item component={<BreadcrumbLink label={section === "archived" ? "Archived" : "Trash"} />} />
          )}
        </Breadcrumbs>
        {navigation}
      </Header.LeftItem>
      <Header.RightItem>
        {search}
        <div className="hidden md:flex">{filters}</div>
        {create}
      </Header.RightItem>
    </Header>
  );
}

export function NativeProjectHeader({
  section,
  search,
  onSearch,
  filters,
  mobileFilters,
  create,
  onSectionChange,
}: {
  section: "active" | "archived" | "trash";
  search: string;
  onSearch: (value: string) => void;
  filters: ReactNode;
  mobileFilters: ReactNode;
  create?: ReactNode;
  onSectionChange: (section: "active" | "archived" | "trash") => void;
}) {
  return (
    <div className="z-[18]">
      <Row className="flex h-11 w-full items-center gap-2 border-b border-subtle bg-surface-1">
        <div className="w-full">
          <ProjectsBaseHeaderView
            section={section}
            search={section === "trash" ? null : <ProjectSearchView value={search} onChange={onSearch} />}
            filters={section === "trash" ? null : filters}
            create={section === "active" ? create : null}
            navigation={
              <CustomMenu
                customButton={<MoreHorizontal className="size-4" aria-label="Project directories" />}
                placement="bottom-start"
                closeOnSelect
              >
                <CustomMenu.MenuItem onClick={() => onSectionChange("active")}>Projects</CustomMenu.MenuItem>
                <CustomMenu.MenuItem onClick={() => onSectionChange("archived")}>Archived projects</CustomMenu.MenuItem>
                <CustomMenu.MenuItem onClick={() => onSectionChange("trash")}>Trash</CustomMenu.MenuItem>
              </CustomMenu>
            }
          />
        </div>
      </Row>
      {section !== "trash" && mobileFilters}
    </div>
  );
}
