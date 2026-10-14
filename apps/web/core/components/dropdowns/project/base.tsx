/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { CheckIcon, SearchIcon, ProjectIcon, ChevronDownIcon } from "@plane/propel/icons";
import { POPUP_OPTION_CLASSNAME, POPUP_SEARCH_CLASSNAME, POPUP_SEARCH_INPUT_CLASSNAME } from "@plane/propel/popover";
import { ComboDropDown } from "@plane/ui";
import { cn, sortBySelectedFirst } from "@plane/utils";
// components
// hooks
import { useDropdown } from "@/hooks/use-dropdown";
// plane web imports
import type { TProject } from "@plane/types";
// local imports
import { DropdownButton } from "../buttons";
import { BUTTON_VARIANTS_WITH_TEXT } from "../constants";
import type { TDropdownProps } from "../types";

type Props = TDropdownProps & {
  button?: ReactNode;
  currentProjectId?: string;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  getProjectById: (projectId: string | null | undefined) => Partial<TProject> | undefined;
  onClose?: () => void;
  projectIds: string[];
  renderByDefault?: boolean;
  renderCondition?: (projectId: string) => boolean;
} & (
    | {
        multiple: false;
        onChange: (val: string) => void;
        value: string | null;
      }
    | {
        multiple: true;
        onChange: (val: string[]) => void;
        value: string[];
      }
  );

export const ProjectDropdownBase = observer(function ProjectDropdownBase(props: Props) {
  const {
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    className = "",
    currentProjectId,
    disabled = false,
    dropdownArrow = false,
    dropdownArrowClassName = "",
    getProjectById,
    hideIcon = false,
    multiple,
    onChange,
    onClose,
    placeholder = "Project",
    placement,
    projectIds,
    renderByDefault = true,
    renderCondition,
    showTooltip = false,
    tabIndex,
    value,
  } = props;
  // refs

  // states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // plane hooks
  const { t } = useTranslation();

  // store hooks
  const options = projectIds?.map((projectId) => {
    const projectDetails = getProjectById(projectId);
    if (renderCondition && !renderCondition(projectId)) return;
    return {
      value: projectId,
      query: `${projectDetails?.name}`,
      content: (
        <div className="flex items-center gap-2">
          {projectDetails?.logo_props && (
            <span className="grid h-4 w-4 flex-shrink-0 place-items-center">
              <Logo logo={projectDetails?.logo_props} size={12} />
            </span>
          )}
          <span className="flex-grow truncate" title={projectDetails?.name}>
            {projectDetails?.name}
          </span>
        </div>
      ),
    };
  });

  const filteredOptions = sortBySelectedFirst(
    (query === ""
      ? options?.filter((o) => o?.value !== currentProjectId)
      : options?.filter((o) => o?.value !== currentProjectId && o?.query.toLowerCase().includes(query.toLowerCase()))
    )?.filter((o): o is NonNullable<typeof o> => o !== undefined),
    value
  );

  const { handleOpenChange } = useDropdown({ onClose, setIsOpen, setQuery });

  const dropdownOnChange = (val: string & string[]) => {
    onChange(val);
  };

  const getDisplayName = (selected: string | string[] | null, fallback: string = "") => {
    if (Array.isArray(selected)) {
      const firstProject = getProjectById(selected[0]);
      return selected.length ? (selected.length === 1 ? firstProject?.name : `${selected.length} projects`) : fallback;
    } else {
      return selected ? (getProjectById(selected)?.name ?? fallback) : fallback;
    }
  };

  const getProjectIcon = (selected: string | string[] | null) => {
    if (Array.isArray(selected)) {
      return (
        <div className="flex items-center gap-0.5">
          {selected.length > 0 ? (
            selected.map((projectId) => {
              const projectDetails = getProjectById(projectId);
              return projectDetails?.logo_props ? renderIcon(projectDetails.logo_props) : null;
            })
          ) : (
            <ProjectIcon className="size-3 text-tertiary" />
          )}
        </div>
      );
    } else {
      const projectDetails = getProjectById(selected);
      return projectDetails?.logo_props ? renderIcon(projectDetails.logo_props) : null;
    }
  };

  const comboButton = button ? (
    <button
      type="button"
      className={cn(
        "clickable block h-full w-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
        buttonContainerClassName
      )}
      disabled={disabled}
    >
      {button}
    </button>
  ) : (
    <button
      type="button"
      className={cn(
        "clickable block h-full max-w-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
        {
          "cursor-not-allowed text-secondary": disabled,
          "cursor-pointer": !disabled,
        },
        buttonContainerClassName
      )}
      disabled={disabled}
    >
      <DropdownButton
        className={buttonClassName}
        isActive={isOpen}
        tooltipHeading="Project"
        tooltipContent={value?.length ? `${value.length} project${value.length !== 1 ? "s" : ""}` : placeholder}
        showTooltip={showTooltip}
        variant={buttonVariant}
        renderToolTipByDefault={renderByDefault}
      >
        {!hideIcon && getProjectIcon(value)}
        {BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant) && (
          <span className="max-w-40 truncate">{getDisplayName(value, placeholder)}</span>
        )}
        {dropdownArrow && (
          <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
        )}
      </DropdownButton>
    </button>
  );

  return (
    <ComboDropDown
      open={isOpen}
      tabIndex={tabIndex}
      className={cn("h-full", className)}
      value={value}
      onChange={dropdownOnChange}
      disabled={disabled}
      button={comboButton}
      multiple={multiple}
      placement={placement}
      onOpenChange={handleOpenChange}
    >
      <div className="z-10">
        <div className="w-56 max-w-[calc(100vw-2rem)]">
          <div className={POPUP_SEARCH_CLASSNAME}>
            <SearchIcon className="size-3.5 flex-none" />
            <Combobox.Input
              className={POPUP_SEARCH_INPUT_CLASSNAME}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
            />
          </div>
          <Combobox.List className="max-h-60 overflow-y-auto">
            {filteredOptions ? (
              filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  if (!option) return;
                  return (
                    <Combobox.Item
                      key={option.value}
                      value={option.value}
                      className={POPUP_OPTION_CLASSNAME}
                      render={(itemProps, { selected }) => (
                        <div {...itemProps}>
                          {
                            <>
                              <span className="flex-grow truncate">{option.content}</span>
                              {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                            </>
                          }
                        </div>
                      )}
                    ></Combobox.Item>
                  );
                })
              ) : (
                <p className="px-2 py-1.5 text-placeholder">{t("no_matching_results")}</p>
              )
            ) : (
              <p className="px-2 py-1.5 text-placeholder">{t("loading")}</p>
            )}
          </Combobox.List>
        </div>
      </div>
    </ComboDropDown>
  );
});

function renderIcon(logoProps: TProject["logo_props"]) {
  return (
    <span className="grid h-4 w-4 flex-shrink-0 place-items-center">
      <Logo logo={logoProps} size={14} />
    </span>
  );
}
