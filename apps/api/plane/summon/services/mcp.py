# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import requests
from django.conf import settings
from rest_framework import serializers

from plane.summon.models import Credential
from plane.summon.services.credential import audit, can_use, decrypt_secret


READ_ACTIONS = {
    "project": {"retrieve", "list"},
    "workitem": {"count", "retrieve", "list", "search"},
    "cycle": {"retrieve", "list"},
    "module": {"retrieve", "list"},
    "state": {"retrieve", "list"},
    "label": {"retrieve", "list"},
    "member": {"me", "list_workspace", "list_project", "list_roles", "retrieve_role"},
}
WRITE_ACTIONS = {
    "project": {"create"},
    "workitem": {"create", "update"},
    "workitem_comment": {"create"},
}
SENSITIVE_KEYS = {"api_key", "authorization", "password", "pat", "secret", "token"}


class MCPError(Exception):
    pass


def sanitize_arguments(value):
    if isinstance(value, dict):
        return {
            key: "[redacted]" if key.lower() in SENSITIVE_KEYS else sanitize_arguments(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [sanitize_arguments(item) for item in value]
    return value


def validate_tool(tool, arguments, write=False):
    actions = WRITE_ACTIONS if write else READ_ACTIONS
    action = arguments.get("action") if isinstance(arguments, dict) else None
    if tool not in actions or action not in actions[tool]:
        raise serializers.ValidationError({"tool": "Tool or action is not available in Summon Assistant v1."})


def _credential(conversation, user):
    credential = conversation.mcp_credential
    if (
        not credential
        or credential.workspace_id != conversation.workspace_id
        or credential.status != Credential.Status.ACTIVE
        or credential.provider not in {"plane", "plane_mcp"}
        or not can_use(credential, user)
    ):
        raise serializers.ValidationError({"mcp_credential": "Select an active Plane PAT you are allowed to use."})
    return credential


def _json(response):
    if response.status_code >= 400:
        raise MCPError(f"mcp_http_{response.status_code}")
    if "application/json" in response.headers.get("content-type", ""):
        return response.json()
    for line in reversed(response.text.splitlines()):
        if line.startswith("data:"):
            return json.loads(line.removeprefix("data:").strip())
    raise MCPError("mcp_invalid_response")


def call_plane_tool(conversation, user, tool, arguments, request=None):
    credential = _credential(conversation, user)
    headers = {
        "Accept": "application/json, text/event-stream",
        "Authorization": f"Bearer {decrypt_secret(credential.secret_ciphertext)}",
        "Content-Type": "application/json",
        "X-Workspace-slug": conversation.workspace.slug,
    }
    try:
        initialize = requests.post(
            settings.SUMMON_MCP_URL,
            headers=headers,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": {"name": "summon-assistant", "version": "1"},
                },
            },
            timeout=15,
        )
        _json(initialize)
        session_id = initialize.headers.get("Mcp-Session-Id")
        if session_id:
            headers["Mcp-Session-Id"] = session_id
        requests.post(
            settings.SUMMON_MCP_URL,
            headers=headers,
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
            timeout=15,
        ).raise_for_status()
        response = requests.post(
            settings.SUMMON_MCP_URL,
            headers=headers,
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {"name": tool, "arguments": arguments},
            },
            timeout=30,
        )
        payload = _json(response)
    except (requests.RequestException, ValueError) as exc:
        raise MCPError("mcp_provider_unavailable") from exc
    finally:
        headers["Authorization"] = "Bearer [redacted]"
    if payload.get("error"):
        raise MCPError("mcp_tool_failed")
    audit(credential, user, "use", request, {"tool": tool, "action": arguments.get("action")})
    return payload.get("result", {})
