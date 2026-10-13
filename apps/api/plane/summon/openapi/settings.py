# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""drf-spectacular settings for the Summon API schema (`/api/summon/`).

This schema is the contract for `packages/summon-contract` (generated Effect client) and for the
AI service's tools. Plane's public `/api/v1/` schema (`plane.settings.openapi`) is separate.

Generate with:
    ENABLE_DRF_SPECTACULAR=1 python manage.py spectacular \
        --custom-settings plane.summon.openapi.settings.SUMMON_SPECTACULAR_SETTINGS \
        --validate --fail-on-warn --file summon-openapi.json --format openapi-json
"""

SUMMON_SPECTACULAR_SETTINGS = {
    "TITLE": "Summon API",
    "DESCRIPTION": "Summon workspace API. Session cookie for the web app; Plane API key (X-Api-Key) for MCP clients.",
    "VERSION": "1.0.0",
    "SCHEMA_PATH_PREFIX": "/api/summon/",
    "SCHEMA_PATH_PREFIX_TRIM": False,
    "PREPROCESSING_HOOKS": ["plane.summon.openapi.hooks.preprocess_summon_paths"],
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "plane.summon.openapi.hooks.postprocess_closed_objects",
    ],
    "GET_LIB_DOC_EXCLUDES": "plane.summon.openapi.hooks.summon_lib_doc_excludes",
    # Clients send JSON; form encodings would only add duplicate request types to the generated client.
    "PARSER_WHITELIST": ["rest_framework.parsers.JSONParser"],
    "AUTHENTICATION_WHITELIST": [
        "plane.authentication.session.BaseSessionAuthentication",
        "plane.summon.authentication.SummonAPIKeyAuthentication",
    ],
    "COMPONENT_NO_READ_ONLY_REQUIRED": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_GENERATE_CHOICE_DESCRIPTION": False,
    "SORT_OPERATIONS": False,
    "ENUM_NAME_OVERRIDES": {
        "AssistantMessageRoleEnum": "plane.summon.models.AssistantMessage.Role",
        "WorkspaceRoleEnum": "plane.summon.views.access.ROLE_CHOICES",
        "MeetingStatusEnum": "plane.summon.models.Meeting.Status",
        "AutomationJobStatusEnum": "plane.summon.models.AutomationJob.Status",
        "ClientStatusEnum": "plane.summon.models.Client.Status",
    },
    "SERVERS": [],
    # 3.1 states nullability as JSON Schema (`oneOf: [ref, {type: null}]`). The client generator ignores
    # 3.0's `allOf` + `nullable`, so 3.0 would make every nullable relation non-null in TypeScript.
    "OAS_VERSION": "3.1.0",
}
