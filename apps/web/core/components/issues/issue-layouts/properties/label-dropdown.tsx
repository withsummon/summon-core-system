/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo, useState } from "react";
import type { TPlacement as Placement } from "@plane/propel/utils";
import { useParams } from "next/navigation";
import { Loader } from "lucide-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
// plane imports
import { EUserPermissionsLevel, getRandomLabelColor } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { CheckIcon, SearchIcon, ChevronDownIcon } from "@plane/propel/icons";
// types
import type { IIssueLabel } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
// components
import { ComboDropDown } from "@plane/ui";
import { sortBySelectedFirst } from "@plane/utils";
// hooks
import { useLabel } from "@/hooks/store/use-label";
import { useUserPermissions } from "@/hooks/store/user";
import { useDropdown } from "@/hooks/use-dropdown";

export interface ILabelDropdownProps {
  projectId: string | null;
  value: string[];
  onChange: (data: string[]) => void;
  onClose?: () => void;
  disabled?: boolean;
  defaultOptions?: any;
  hideDropdownArrow?: boolean;
  className?: string;
  buttonClassName?: string;
  optionsClassName?: string;
  placement?: Placement;
  maxRender?: number;
  renderByDefault?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
  label: React.ReactNode;
}

export function LabelDropdown(props: ILabelDropdownProps) {
  const {
    projectId,
    value,
    onChange,
    onClose,
    disabled,
    defaultOptions = [],
    hideDropdownArrow = false,
    className,
    buttonClassName = "",
    optionsClassName = "",
    placement,
    maxRender = 2,
    renderByDefault = true,
    fullWidth = false,
    fullHeight = false,
    label,
  } = props;
  const { t } = useTranslation();

  //router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();

  //states
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  //refs

  //hooks
  const { fetchProjectLabels, getProjectLabels, createLabel } = useLabel();
  const storeLabels = getProjectLabels(projectId);
  const { allowPermissions } = useUserPermissions();

  const canCreateLabel =
    projectId && allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  let projectLabels: IIssueLabel[] = defaultOptions;
  if (storeLabels && storeLabels.length > 0) projectLabels = storeLabels;

  const options = useMemo(
    () =>
      projectLabels.map((label) => ({
        value: label?.id,
        query: label?.name,
        content: (
          <div className="flex items-center justify-start gap-2 overflow-hidden">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{
                backgroundColor: label?.color,
              }}
            />
            <div className="line-clamp-1 inline-block truncate">{label?.name}</div>
          </div>
        ),
      })),
    [projectLabels]
  );

  const filteredOptions = useMemo(
    () =>
      sortBySelectedFirst(
        query === "" ? options : options?.filter((option) => option.query.toLowerCase().includes(query.toLowerCase())),
        value
      ),
    [options, query, value]
  );

  const onOpen = useCallback(() => {
    if (!storeLabels && workspaceSlug && projectId)
      fetchProjectLabels(workspaceSlug, projectId)
        .then(() => setIsLoading(false))
        .catch(() => {
          setIsLoading(false);
        });
  }, [storeLabels, workspaceSlug, projectId, fetchProjectLabels, setIsLoading]);

  const handleAddLabel = async (labelName: string) => {
    if (!projectId) return;
    setSubmitting(true);
    const label = await createLabel(workspaceSlug, projectId, { name: labelName, color: getRandomLabelColor() });
    onChange([...value, label.id]);
    setQuery("");
    setSubmitting(false);
  };

  const { handleOpenChange } = useDropdown({ setIsOpen, onOpen, onClose, setQuery });

  const searchInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      query !== "" &&
      e.key === "Enter" &&
      !e.nativeEvent.isComposing &&
      canCreateLabel &&
      filteredOptions?.length === 0
    ) {
      e.preventDefault();
      await handleAddLabel(query);
    }
  };

  const comboButton = useMemo(
    () => (
      <button
        type="button"
        className={`clickable flex h-full w-full items-center justify-center gap-1 text-caption-sm-regular ${fullWidth && "hover:bg-layer-1"} ${
          disabled
            ? "cursor-not-allowed text-secondary"
            : value.length <= maxRender
              ? "cursor-pointer"
              : "cursor-pointer hover:bg-layer-1"
        } ${buttonClassName}`}
        disabled={disabled}
      >
        {label}
        {!hideDropdownArrow && !disabled && <ChevronDownIcon className="h-3 w-3" aria-hidden="true" />}
      </button>
    ),
    [buttonClassName, disabled, fullWidth, , hideDropdownArrow, label, maxRender, value.length]
  );

  const preventPropagation = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className={`${fullHeight ? "h-full" : "h-5"}`} onClick={preventPropagation}>
      <ComboDropDown
        open={isOpen}
        className={`h-full w-auto max-w-full flex-shrink-0 text-left ${className}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        button={comboButton}
        multiple
        placement={placement}
        onOpenChange={handleOpenChange}
      >
        {isOpen && (
          <div className="z-10">
            <div
              className={`z-10 my-1 h-auto w-48 rounded-sm border border-strong bg-surface-1 px-2 py-2.5 text-caption-sm-regular whitespace-nowrap shadow-raised-200 focus:outline-none ${optionsClassName}`}
            >
              <div className="flex w-full items-center justify-start rounded-sm border border-subtle bg-surface-2 px-2">
                <SearchIcon className="h-3.5 w-3.5 text-tertiary" />
                <Combobox.Input
                  className="w-full bg-transparent px-2 py-1 text-caption-sm-regular text-secondary placeholder:text-placeholder focus:outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("common.search.label")}
                  onKeyDown={searchInputKeyDown}
                />
              </div>
              <Combobox.List className={`mt-2 max-h-48 space-y-1 overflow-y-scroll`}>
                {isLoading ? (
                  <p className="text-center text-secondary">{t("common.loading")}</p>
                ) : filteredOptions && filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <Combobox.Item
                      key={option.value}
                      value={option.value}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      className={({ highlighted: active, selected }) =>
                        `flex cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 select-none hover:bg-layer-1 ${
                          active ? "bg-layer-1" : ""
                        } ${selected ? "text-primary" : "text-secondary"}`
                      }
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
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                ) : canCreateLabel ? (
                  <p
                    onClick={() => {
                      if (!query.length) return;
                      handleAddLabel(query);
                    }}
                    className={`text-left text-secondary ${query.length ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {/* TODO: translate here */}
                    {query.length ? (
                      <>
                        + Add <span className="text-primary">&quot;{query}&quot;</span> to labels
                      </>
                    ) : (
                      t("label.create.type")
                    )}
                  </p>
                ) : (
                  <p className="text-left text-secondary">{t("common.search.no_matching_results")}</p>
                )}
              </Combobox.List>
            </div>
          </div>
        )}
      </ComboDropDown>
    </div>
  );
}
