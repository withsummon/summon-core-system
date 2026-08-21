# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.summon.models import Opportunity


def transition_opportunity(opportunity: Opportunity, stage: str, actor, probability=None) -> Opportunity:
    opportunity.stage = stage
    opportunity.updated_by = actor
    update_fields = ["stage", "updated_by", "updated_at"]
    if probability is not None:
        opportunity.probability = probability
        update_fields.append("probability")
    opportunity.save(disable_auto_set_user=True, update_fields=update_fields)
    return opportunity
