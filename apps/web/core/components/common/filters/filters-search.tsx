/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SearchIcon, CloseIcon } from "@plane/propel/icons";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/** Search box pinned above a filters dropdown's option list. */
export function FiltersSearch(props: Props) {
  const { value, onChange } = props;
  const { isMobile } = usePlatformOS();

  return (
    <div className="bg-surface-1 p-2.5 pb-0">
      <div className="flex items-center gap-1.5 rounded-sm border-[0.5px] border-subtle bg-surface-2 px-1.5 py-1 text-11 focus-within:border-accent-strong">
        <SearchIcon className="text-placeholder" width={12} height={12} strokeWidth={2} />
        <input
          type="text"
          className="w-full bg-surface-2 outline-none placeholder:text-placeholder"
          placeholder="Search"
          aria-label="Search filters"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // oxlint-disable-next-line jsx_a11y/no-autofocus
          autoFocus={!isMobile}
        />
        {value !== "" && (
          <button
            aria-label="Clear search"
            type="button"
            className="grid place-items-center"
            onClick={() => onChange("")}
          >
            <CloseIcon className="text-tertiary" height={12} width={12} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
