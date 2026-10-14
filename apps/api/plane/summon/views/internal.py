# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.app.services.llm import LLMError, get_llm_config
from plane.summon.permissions import AIServicePermission
from plane.summon.serializers.operations import AIConfigSerializer
from plane.summon.serializers.shapes import ErrorCodeSerializer
from plane.summon.views.base import SummonAPIView


class AIConfigView(SummonAPIView):
    """Provider settings for the AI service. God-mode's AI form stays the only place they are edited."""

    summon_tool = "none"
    authentication_classes = []
    permission_classes = [AIServicePermission]

    @extend_schema(responses={200: AIConfigSerializer, 503: ErrorCodeSerializer})
    def get(self, request):
        try:
            config = get_llm_config()
        except LLMError as error:
            return Response({"error_code": error.code}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        response = Response(
            AIConfigSerializer(
                {
                    "provider": config["provider"],
                    "model": config["model"],
                    "api_key": config["api_key"],
                    "base_url": config["base_url"],
                    "timeout_seconds": config["timeout"],
                }
            ).data
        )
        response["Cache-Control"] = "no-store"
        return response
