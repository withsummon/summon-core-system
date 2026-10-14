# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.apps import AppConfig


class SummonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "plane.summon"

    def ready(self):
        from django.conf import settings

        if getattr(settings, "ENABLE_DRF_SPECTACULAR", False):
            import plane.summon.openapi.extensions  # noqa: F401
