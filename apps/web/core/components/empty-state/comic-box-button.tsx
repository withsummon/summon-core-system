/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button } from "@plane/propel/button";
import { Tooltip } from "@plane/propel/tooltip";

type Props = {
  label: string;
  icon?: React.ReactNode;
  title: string | undefined;
  description: string | undefined;
  onClick?: () => void;
  disabled?: boolean;
};

export function ComicBoxButton({ label, icon, title, description, onClick, disabled = false }: Props) {
  return (
    <Tooltip tooltipHeading={title} tooltipContent={description} position="right-end">
      <Button variant="primary" size="lg" onClick={onClick} disabled={disabled}>
        {icon}
        <span className="leading-4">{label}</span>
        <span className="relative size-2" aria-hidden="true">
          <span className="bg-blue-300 absolute right-0 size-2.5 animate-ping rounded-full motion-reduce:animate-none" />
          <span className="bg-blue-400/40 absolute right-0 mt-0.5 mr-0.5 size-1.5 rounded-full" />
        </span>
      </Button>
    </Tooltip>
  );
}
