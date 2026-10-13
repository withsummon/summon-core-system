# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.api.rate_limit import ApiKeyRateThrottle
from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.authentication.session import BaseSessionAuthentication
from plane.summon.authentication import SummonAPIKeyAuthentication
from plane.summon.openapi.schema import SummonAutoSchema

# Browser session first; Plane API keys (X-Api-Key) for MCP clients and other API callers.
SUMMON_AUTHENTICATION = [BaseSessionAuthentication, SummonAPIKeyAuthentication]
SESSION_ONLY_AUTHENTICATION = [BaseSessionAuthentication]


class SummonAuthMixin:
    authentication_classes = SUMMON_AUTHENTICATION
    schema = SummonAutoSchema()
    # Summon views scope their querysets themselves; Plane's default filter backends are unused.
    filter_backends = ()

    def get_throttles(self):
        throttles = super().get_throttles()
        if self.request.headers.get(SummonAPIKeyAuthentication.auth_header_name):
            throttles = [*throttles, ApiKeyRateThrottle()]
        return throttles


class SummonAPIView(SummonAuthMixin, BaseAPIView):
    pass


class SummonViewSet(SummonAuthMixin, BaseViewSet):
    @property
    def queryset(self):
        # Lets schema generation resolve the model without URL kwargs; every Summon viewset scopes
        # its real queryset in `get_queryset`.
        return self.model.objects.none()
