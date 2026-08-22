# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.api.serializers.base import BaseSerializer
from plane.db.models import ProjectMember
from plane.summon.models import Credential, CredentialAccessLog, CredentialGrant
from plane.summon.services.credential import MASKED_SECRET, audit, encrypt_secret


class CredentialSerializer(BaseSerializer):
    secret = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = Credential
        fields = [
            "id",
            "project",
            "owner",
            "name",
            "provider",
            "account_identifier",
            "secret",
            "key_version",
            "metadata",
            "status",
            "revoked_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "key_version", "status", "revoked_at", "created_at", "updated_at"]

    def validate(self, attrs):
        workspace = self.context["workspace"]
        user = self.context["request"].user
        project = attrs.get("project", self.instance.project if self.instance else None)
        if project and (
            project.workspace_id != workspace.id
            or project.deleted_at
            or not ProjectMember.objects.filter(
                workspace=workspace,
                project=project,
                member=user,
                role__in=[20, 15],
                is_active=True,
            ).exists()
        ):
            raise serializers.ValidationError({"project": "Active Project membership is required."})
        if self.instance and "secret" in attrs:
            raise serializers.ValidationError({"secret": "Use the rotate action to replace a secret."})
        return attrs

    def create(self, validated_data):
        secret = validated_data.pop("secret")
        credential = Credential.objects.create(
            **validated_data,
            workspace=self.context["workspace"],
            owner=self.context["request"].user,
            secret_ciphertext=encrypt_secret(secret),
        )
        audit(credential, self.context["request"].user, "create", self.context["request"])
        return credential

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["secret"] = MASKED_SECRET
        return data


class CredentialGrantSerializer(BaseSerializer):
    class Meta:
        model = CredentialGrant
        fields = ["id", "member", "permission", "expires_at", "granted_by", "created_at"]
        read_only_fields = ["granted_by", "created_at"]


class CredentialAccessLogSerializer(BaseSerializer):
    class Meta:
        model = CredentialAccessLog
        fields = ["id", "member", "action", "reason", "metadata", "ip_address", "user_agent", "created_at"]
        read_only_fields = fields


class CredentialRevealSerializer(serializers.Serializer):
    password = serializers.CharField(trim_whitespace=False)


class CredentialRotateSerializer(CredentialRevealSerializer):
    secret = serializers.CharField(trim_whitespace=False)
