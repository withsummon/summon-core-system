# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python import
import os

# Third party import
import requests

from rest_framework import status
from rest_framework.response import Response

# Module import
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import ProjectLiteSerializer, WorkspaceLiteSerializer
from plane.app.services.llm import LLMError, LLMRequest, generate
from plane.db.models import Project, Workspace
from plane.license.utils.instance_value import get_configuration_value

from ..base import BaseAPIView


def get_llm_response(task, prompt):
    try:
        response = generate(
            LLMRequest(
                system=str(task),
                messages=[{"role": "user", "content": str(prompt or "")}],
            )
        )
        return response.text, None
    except LLMError as error:
        return None, error


class GPTIntegrationEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        task = request.data.get("task", False)
        if not task:
            return Response({"error": "Task is required"}, status=status.HTTP_400_BAD_REQUEST)

        text, error = get_llm_response(task, request.data.get("prompt", False))
        if error:
            return Response(
                {
                    "error": (
                        "LLM provider API key and model are required"
                        if error.code == "llm_not_configured"
                        else "An internal error has occurred."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                    if error.code == "llm_not_configured"
                    else status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        workspace = Workspace.objects.get(slug=slug)
        project = Project.objects.get(pk=project_id)

        return Response(
            {
                "response": text,
                "response_html": text.replace("\n", "<br/>"),
                "project_detail": ProjectLiteSerializer(project).data,
                "workspace_detail": WorkspaceLiteSerializer(workspace).data,
            },
            status=status.HTTP_200_OK,
        )


class WorkspaceGPTIntegrationEndpoint(BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        task = request.data.get("task", False)
        if not task:
            return Response({"error": "Task is required"}, status=status.HTTP_400_BAD_REQUEST)

        text, error = get_llm_response(task, request.data.get("prompt", False))
        if error:
            return Response(
                {
                    "error": (
                        "LLM provider API key and model are required"
                        if error.code == "llm_not_configured"
                        else "An internal error has occurred."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                    if error.code == "llm_not_configured"
                    else status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        return Response(
            {
                "response": text,
                "response_html": text.replace("\n", "<br/>"),
            },
            status=status.HTTP_200_OK,
        )


class UnsplashEndpoint(BaseAPIView):
    def get(self, request):
        (UNSPLASH_ACCESS_KEY,) = get_configuration_value(
            [
                {
                    "key": "UNSPLASH_ACCESS_KEY",
                    "default": os.environ.get("UNSPLASH_ACCESS_KEY"),
                }
            ]
        )
        # Check unsplash access key
        if not UNSPLASH_ACCESS_KEY:
            return Response([], status=status.HTTP_200_OK)

        # Query parameters
        query = request.GET.get("query", False)
        page = request.GET.get("page", 1)
        per_page = request.GET.get("per_page", 20)

        url = (
            f"https://api.unsplash.com/search/photos/?client_id={UNSPLASH_ACCESS_KEY}&query={query}&page=${page}&per_page={per_page}"
            if query
            else f"https://api.unsplash.com/photos/?client_id={UNSPLASH_ACCESS_KEY}&page={page}&per_page={per_page}"
        )

        headers = {"Content-Type": "application/json"}

        resp = requests.get(url=url, headers=headers)
        return Response(resp.json(), status=resp.status_code)
