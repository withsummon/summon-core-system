# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema rules shared by every Summon view.

Operation ids come from the Django URL names in `plane.summon.urls`, so they stay stable and
readable: they are the method names of the generated client and the tool names the AI service
exposes to the assistant and to MCP clients.

`x-summon-tool` tells the AI service what it may do with an operation:
- `read`: the assistant and MCP clients may call it directly.
- `write`: MCP clients may call it; the in-app assistant needs the user's confirmation.
- `none`: never exposed as a tool (secrets, binary downloads, internal endpoints, the turn protocol).
Views set `summon_tool = "none"` (all methods) or `summon_tool = {"POST": "none"}` to override the
method default (GET → read, everything else → write).

Descriptions are what the model and MCP clients read to pick a tool, so every tool operation needs
one: `@extend_schema(description=…)` on APIView methods, generated from the model name for viewset
CRUD. Generation with `--fail-on-warn` fails on a tool without one.
"""

import re
from functools import cache

from drf_spectacular.drainage import warn
from drf_spectacular.openapi import AutoSchema

TOOL_MODES = {"read", "write", "none"}
_DETAIL_SUFFIX = {"GET": "get", "PATCH": "update", "PUT": "replace", "DELETE": "delete"}
_CRUD_DESCRIPTIONS = {
    "list": "List the {plural} in this workspace that you can see.",
    "create": "Create {a_name}.",
    "retrieve": "Get one {name} by id.",
    "partial_update": "Update fields on {a_name}; omitted fields are unchanged.",
    "update": "Replace {a_name}.",
    "destroy": "Delete {a_name}.",
}


def _crud_description(template, model):
    # Model verbose names are Django's defaults ("summon page context", "opportunitys"); tidy them
    # here rather than adding model Meta changes (and migrations) for schema text.
    name = str(model._meta.verbose_name).removeprefix("summon ")
    plural = f"{name[:-1]}ies" if name.endswith("y") and name[-2] not in "aeiou" else f"{name}s"
    article = "an" if name[0] in "aeiou" else "a"
    return template.format(name=name, plural=plural, a_name=f"{article} {name}")


@cache
def _route_names():
    from django.urls import URLPattern

    from plane.summon import urls

    names = {}
    for pattern in urls.urlpatterns:
        if isinstance(pattern, URLPattern) and pattern.name:
            route = re.sub(r"<(?:\w+:)?(\w+)>", r"{\1}", str(pattern.pattern))
            names[f"/api/summon/{route}"] = pattern.name.removeprefix("summon-").replace("-", "_")
    return names


class SummonAutoSchema(AutoSchema):
    def get_operation_id(self):
        name = _route_names().get(self.path)
        if not name:
            return super().get_operation_id()
        if name.endswith("_list"):
            return name if self.method == "GET" else f"{name.removesuffix('_list')}_create"
        if name.endswith("_detail"):
            return f"{name.removesuffix('_detail')}_{_DETAIL_SUFFIX.get(self.method, self.method.lower())}"
        allowed = {method.upper() for method in self.view.allowed_methods if method not in {"OPTIONS", "HEAD"}}
        return name if len(allowed) <= 1 else f"{name}_{self.method.lower()}"

    def get_description(self):
        description = super().get_description()
        model = getattr(self.view, "model", None)
        template = _CRUD_DESCRIPTIONS.get(getattr(self.view, "action", None))
        if description or not (model and template):
            return description
        return _crud_description(template, model)

    def get_extensions(self):
        extensions = super().get_extensions()
        policy = getattr(self.view, "summon_tool", None)
        mode = policy.get(self.method) if isinstance(policy, dict) else policy
        if mode is None:
            mode = "read" if self.method == "GET" else "write"
        if mode not in TOOL_MODES:
            raise ValueError(f"Unknown summon_tool mode {mode!r} on {type(self.view).__name__}")
        if mode != "none" and not self.get_description():
            warn(f"{self.method} {self.path} is a Summon tool without a description")
        return {**extensions, "x-summon-tool": mode}
