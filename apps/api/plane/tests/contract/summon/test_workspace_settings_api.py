# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import User, WorkspaceMember


@pytest.mark.django_db
def test_workspace_settings_persist_plane_and_summon_owned_fields(session_client, workspace):
    url = f"/api/summon/workspaces/{workspace.slug}/settings/workspace/"
    response = session_client.patch(
        url,
        {
            "name": "Summon Indonesia",
            "industry": "Technology",
            "description": "Delivery workspace",
            "currency": "IDR",
            "workweek": ["mon", "tue", "wed", "thu", "fri"],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    reloaded = session_client.get(url)
    assert reloaded.status_code == status.HTTP_200_OK
    assert reloaded.data["name"] == "Summon Indonesia"
    assert reloaded.data["industry"] == "Technology"
    assert reloaded.data["description"] == "Delivery workspace"
    assert reloaded.data["currency"] == "IDR"
    assert reloaded.data["workweek"] == ["mon", "tue", "wed", "thu", "fri"]


@pytest.mark.django_db
def test_workspace_settings_reject_invalid_workweek_and_member_write(session_client, workspace):
    url = f"/api/summon/workspaces/{workspace.slug}/settings/workspace/"

    invalid = session_client.patch(url, {"workweek": ["mon", "funday"]}, format="json")
    assert invalid.status_code == status.HTTP_400_BAD_REQUEST

    identity = uuid4().hex
    member = User.objects.create(email=f"settings-{identity}@plane.test", username=f"settings_{identity}")
    WorkspaceMember.objects.create(workspace=workspace, member=member, role=15)
    member_client = APIClient()
    member_client.force_authenticate(user=member)
    denied = member_client.patch(url, {"industry": "Denied"}, format="json")
    assert denied.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_mcp_status_reports_reachability_without_exposing_internal_url(session_client, workspace, monkeypatch):
    class Response:
        status_code = 401

    monkeypatch.setattr("plane.summon.views.settings.requests.get", lambda *args, **kwargs: Response())
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/settings/mcp-status/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["reachable"] is True
    assert response.data["endpoint"] == "/mcp/http/api-key/mcp"
    assert "http://mcp" not in str(response.data)
