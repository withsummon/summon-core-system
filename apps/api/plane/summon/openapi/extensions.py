# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""drf-spectacular extensions for Summon authentication (loaded by `SummonConfig.ready`)."""

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SessionCookieAuthenticationExtension(OpenApiAuthenticationExtension):
    target_class = "plane.authentication.session.BaseSessionAuthentication"
    name = "SessionCookie"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": "session-id"}


class SummonAPIKeyAuthenticationExtension(OpenApiAuthenticationExtension):
    target_class = "plane.summon.authentication.SummonAPIKeyAuthentication"
    name = "ApiKey"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "header", "name": "X-Api-Key"}
