/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Loader } from "lucide-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
// plane imports
import { EUserPermissionsLevel, getRandomLabelColor } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { CheckIcon, SearchIcon, PlusIcon } from "@plane/propel/icons";
import {
  POPUP_CLASSNAME,
  POPUP_OPTION_CLASSNAME,
  POPUP_SEARCH_CLASSNAME,
  POPUP_SEARCH_INPUT_CLASSNAME,
} from "@plane/propel/popover";
import type { IIssueLabel } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
// helpers
import { cn, getTabIndex } from "@plane/utils";
// hooks
import { useLabel } from "@/hooks/store/use-label";
import { useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
//constants
export interface IIssueLabelSelect {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  values: string[];
  onSelect: (_labelIds: string[]) => void;
  onAddLabel: (workspaceSlug: string, projectId: string, data: Partial<IIssueLabel>) => Promise<any>;
}

export const IssueLabelSelect = observer(function IssueLabelSelect(props: IIssueLabelSelect) {
  const { workspaceSlug, projectId, issueId, values, onSelect, onAddLabel } = props;
  const { t } = useTranslation();
  // store hooks
  const { isMobile } = usePlatformOS();
  const { fetchProjectLabels, getProjectLabels } = useLabel();
  const { allowPermissions } = useUserPermissions();
  // states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const canCreateLabel =
    projectId && allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  const projectLabels = getProjectLabels(projectId);

  const { baseTabIndex } = getTabIndex(undefined, isMobile);

  const fetchLabels = () => {
    setIsLoading(true);
    if (!projectLabels && workspaceSlug && projectId)
      fetchProjectLabels(workspaceSlug, projectId).then(() => setIsLoading(false));
  };

  const options = (projectLabels ?? []).map((label) => ({
    value: label.id,
    query: label.name,
    content: (
      <div className="flex items-center justify-start gap-2 overflow-hidden">
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{
            backgroundColor: label.color,
          }}
        />
        <div className="line-clamp-1 inline-block truncate">{label.name}</div>
      </div>
    ),
  }));

  const filteredOptions =
    query === "" ? options : options?.filter((option) => option.query.toLowerCase().includes(query.toLowerCase()));

  const issueLabels = values ?? [];

  const label = <span className="text-body-xs-medium text-placeholder">{t("label.select")}</span>;

  const searchInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (query !== "" && e.key === "Escape") {
      e.stopPropagation();
      setQuery("");
    }

    if (query !== "" && e.key === "Enter" && !e.nativeEvent.isComposing && canCreateLabel) {
      e.stopPropagation();
      e.preventDefault();
      await handleAddLabel(query);
    }
  };

  const handleAddLabel = async (labelName: string) => {
    setSubmitting(true);
    const created = await onAddLabel(workspaceSlug, projectId, { name: labelName, color: getRandomLabelColor() });
    onSelect([...values, created.id]);
    setQuery("");
    setSubmitting(false);
  };

  if (!issueId || !values) return <></>;

  return (
    <>
      <div className="size-full flex-shrink-0 text-left">
        <Combobox.Root filter={null} value={issueLabels} onValueChange={(value) => onSelect(value)} multiple>
          <Combobox.Trigger
            render={
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                prependIcon={<PlusIcon />}
                onClick={() => !projectLabels && fetchLabels()}
              >
                {label}
              </Button>
            }
          />

          <Combobox.Portal>
            <Combobox.Positioner sideOffset={4} align="start" className="z-50">
              <Combobox.Popup className={POPUP_CLASSNAME}>
                <div className="w-56 max-w-[calc(100vw-2rem)]">
                  <div className={POPUP_SEARCH_CLASSNAME}>
                    <SearchIcon className="size-3.5 flex-none" />
                    <Combobox.Input
                      className={POPUP_SEARCH_INPUT_CLASSNAME}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("common.search.label")}
                      onKeyDown={searchInputKeyDown}
                      tabIndex={baseTabIndex}
                    />
                  </div>
                  <Combobox.List className="vertical-scrollbar scrollbar-sm max-h-60 overflow-y-auto">
                    {isLoading ? (
                      <p className="text-center text-secondary">{t("common.loading")}</p>
                    ) : filteredOptions.length > 0 ? (
                      filteredOptions.map((option) => (
                        <Combobox.Item
                          key={option.value}
                          value={option.value}
                          className={cn(POPUP_OPTION_CLASSNAME, "justify-between")}
                          render={(itemProps, { selected }) => (
                            <div {...itemProps}>
                              {
                                <>
                                  {option.content}
                                  {selected && (
                                    <div className="flex-shrink-0">
                                      <CheckIcon className={`h-3.5 w-3.5`} />
                                    </div>
                                  )}
                                </>
                              }
                            </div>
                          )}
                        ></Combobox.Item>
                      ))
                    ) : submitting ? (
                      <Loader className="spin h-3.5 w-3.5" />
                    ) : canCreateLabel ? (
                      <Combobox.Item
                        value={query}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!query.length) return;
                          handleAddLabel(query);
                        }}
                        className={POPUP_OPTION_CLASSNAME}
                      >
                        {query.length ? (
                          <>
                            {/* TODO: Translate here */}+ Add <span className="text-primary">&quot;{query}&quot;</span>{" "}
                            to labels
                          </>
                        ) : (
                          t("label.create.type")
                        )}
                      </Combobox.Item>
                    ) : (
                      <p className="text-left text-secondary">{t("common.search.no_matching_results")}</p>
                    )}
                  </Combobox.List>
                </div>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    </>
  );
});
