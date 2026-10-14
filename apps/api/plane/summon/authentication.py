# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.exceptions import AuthenticationFailed

from plane.api.middleware.api_authentication import APIKeyAuthentication
from plane.db.models import APIToken


class SummonAPIKeyAuthentication(APIKeyAuthentication):
    """Plane API key for Summon endpoints, used by MCP clients through the AI service.

    A token issued for one workspace only authenticates requests to that workspace's URLs.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        slug = (request.parser_context or {}).get("kwargs", {}).get("slug")
        token_slug = (
            APIToken.objects.filter(token=token, workspace__isnull=False)
            .values_list("workspace__slug", flat=True)
            .first()
        )
        if slug and token_slug and token_slug != slug:
            raise AuthenticationFailed("This API token belongs to a different workspace")
        return user, token
