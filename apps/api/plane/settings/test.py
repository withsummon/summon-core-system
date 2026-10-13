# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Test Settings"""

from .common import *  # noqa

DEBUG = True

# Send it in a dummy outbox
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

INSTALLED_APPS.append(  # noqa
    "plane.tests"
)

# The Summon OpenAPI contract test generates the schema in-process, as `manage.py spectacular` does
# with ENABLE_DRF_SPECTACULAR=1 (the schema class is bound when views are decorated, at import).
if not ENABLE_DRF_SPECTACULAR:  # noqa
    ENABLE_DRF_SPECTACULAR = True
    REST_FRAMEWORK["DEFAULT_SCHEMA_CLASS"] = "drf_spectacular.openapi.AutoSchema"  # noqa
    INSTALLED_APPS.append("drf_spectacular")  # noqa
    from .openapi import SPECTACULAR_SETTINGS  # noqa: F401
