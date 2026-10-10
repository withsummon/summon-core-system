/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  CheckCircleIcon,
  CircleDashedIcon,
  CircleHalfIcon,
  CircleIcon,
  ClockIcon,
  FileTextIcon,
  HandshakeIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  SealCheckIcon,
  TrophyIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Badge } from "@plane/propel/badge";
import type { TBadgeVariant } from "@plane/propel/badge";
import { capitalizeFirstLetter, replaceUnderscoreIfSnakeCase } from "@plane/utils";

type TStatusPresentation = { icon: Icon; variant: TBadgeVariant };

/*
 * Status vocabularies the Summon API returns: Plane state groups, opportunity stages
 * (TSummonOpportunityStage), and project health / delivery status (SummonProjectProfile).
 */
const STATUS_PRESENTATION: Record<string, TStatusPresentation> = {
  backlog: { icon: CircleDashedIcon, variant: "neutral" },
  unstarted: { icon: CircleIcon, variant: "neutral" },
  started: { icon: CircleHalfIcon, variant: "brand" },
  completed: { icon: CheckCircleIcon, variant: "success" },
  cancelled: { icon: XCircleIcon, variant: "danger" },
  lead: { icon: CircleIcon, variant: "neutral" },
  qualified: { icon: SealCheckIcon, variant: "brand" },
  proposal: { icon: FileTextIcon, variant: "brand" },
  negotiation: { icon: HandshakeIcon, variant: "warning" },
  won: { icon: TrophyIcon, variant: "success" },
  lost: { icon: XCircleIcon, variant: "danger" },
  not_assessed: { icon: CircleDashedIcon, variant: "neutral" },
  on_track: { icon: CheckCircleIcon, variant: "success" },
  at_risk: { icon: WarningCircleIcon, variant: "warning" },
  off_track: { icon: XCircleIcon, variant: "danger" },
  planning: { icon: ClockIcon, variant: "neutral" },
  active: { icon: PlayCircleIcon, variant: "brand" },
  on_hold: { icon: PauseCircleIcon, variant: "warning" },
};

/**
 * A status pill whose icon and tone come from the status value itself.
 * `status` is the machine value used for presentation; `label` overrides the humanized text
 * (for example a workspace's own state name within a state group).
 */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const presentation = STATUS_PRESENTATION[status] ?? { icon: CircleIcon, variant: "neutral" };
  return (
    <Badge variant={presentation.variant} size="lg" icon={presentation.icon}>
      {label ?? capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(status))}
    </Badge>
  );
}
