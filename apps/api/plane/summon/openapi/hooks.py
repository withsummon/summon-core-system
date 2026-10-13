# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

SUMMON_PREFIX = "/api/summon/"


def preprocess_summon_paths(endpoints):
    """Keep only the Summon API in the Summon schema."""
    return [endpoint for endpoint in endpoints if endpoint[0].startswith(SUMMON_PREFIX)]


def summon_lib_doc_excludes():
    """Stop descriptions at Plane's base classes, whose docstrings describe the framework, not the endpoint.

    Descriptions become MCP tool and schema descriptions, so they must only come from Summon classes.
    """
    from drf_spectacular.plumbing import get_lib_doc_excludes

    from plane.api.serializers.base import BaseSerializer
    from plane.app.views.base import BaseAPIView, BaseViewSet, TimezoneMixin

    return [*get_lib_doc_excludes(), BaseSerializer, BaseAPIView, BaseViewSet, TimezoneMixin]


def postprocess_closed_objects(result, generator, request, public):
    """Mark serializer objects closed: they list every field Django emits or accepts.

    Without this, generated TypeScript types carry an `[x: string]: Json` index signature, so a
    misspelt field compiles. Decoders still ignore unknown keys, so an added field never breaks a
    running client; the contract drift check makes sure it is regenerated.
    """
    for schema in result.get("components", {}).get("schemas", {}).values():
        if schema.get("type") == "object" and "properties" in schema:
            schema.setdefault("additionalProperties", False)
    return result
