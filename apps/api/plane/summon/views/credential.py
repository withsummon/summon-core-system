# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework import status
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import WorkspaceMember
from plane.summon.models import Credential, CredentialAccessLog, CredentialGrant
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers.credential import (
    CredentialAccessLogSerializer,
    CredentialGrantSerializer,
    CredentialRevealSerializer,
    CredentialRotateSerializer,
    CredentialSerializer,
)
from plane.summon.services.credential import (
    audit,
    can_manage,
    can_reveal,
    decrypt_secret,
    encrypt_secret,
    verify_password,
)
from plane.summon.views.commercial import WorkspaceContextMixin


def accessible_credentials(workspace, user):
    now = timezone.now()
    return (
        Credential.objects.filter(workspace=workspace)
        .filter(
            Q(owner=user)
            | Q(
                grants__member=user,
                grants__deleted_at__isnull=True,
                grants__expires_at__isnull=True,
            )
            | Q(grants__member=user, grants__deleted_at__isnull=True, grants__expires_at__gt=now)
        )
        .distinct()
    )


class CredentialViewSet(WorkspaceContextMixin, BaseViewSet):
    model = Credential
    serializer_class = CredentialSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        return accessible_credentials(self.get_workspace(), self.request.user).select_related("project", "owner")

    def partial_update(self, request, *args, **kwargs):
        if not can_manage(self.get_object(), request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        credential = self.get_object()
        if not can_manage(credential, request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        verify_password(credential, request, "delete")
        audit(credential, request.user, "delete", request)
        now = timezone.now()
        CredentialGrant.objects.filter(credential=credential).update(deleted_at=now)
        Credential.objects.filter(pk=credential.pk).update(
            deleted_at=now,
            status=Credential.Status.REVOKED,
            revoked_at=now,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CredentialActionView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get_credential(self):
        return get_object_or_404(
            accessible_credentials(self.get_workspace(), self.request.user),
            id=self.kwargs["credential_id"],
        )


class CredentialRevealView(CredentialActionView):
    def post(self, request, slug, credential_id):
        credential = self.get_credential()
        if not can_reveal(credential, request.user):
            audit(credential, request.user, "reveal_denied", request)
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = CredentialRevealSerializer(data=request.data)
        if not serializer.is_valid():
            audit(credential, request.user, "reveal_denied", request)
            raise serializers.ValidationError(serializer.errors)
        verify_password(credential, request, "reveal")
        secret = decrypt_secret(credential.secret_ciphertext)
        audit(credential, request.user, "reveal", request)
        response = Response({"secret": secret})
        response["Cache-Control"] = "no-store"
        response["Pragma"] = "no-cache"
        return response


class CredentialRotateView(CredentialActionView):
    def post(self, request, slug, credential_id):
        credential = self.get_credential()
        if not can_manage(credential, request.user):
            audit(credential, request.user, "rotate_denied", request)
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = CredentialRotateSerializer(data=request.data)
        if not serializer.is_valid():
            audit(credential, request.user, "rotate_denied", request)
            raise serializers.ValidationError(serializer.errors)
        verify_password(credential, request, "rotate")
        credential.secret_ciphertext = encrypt_secret(serializer.validated_data["secret"])
        credential.key_version = 1
        credential.save(update_fields=["secret_ciphertext", "key_version", "updated_at"])
        audit(credential, request.user, "rotate", request)
        return Response(CredentialSerializer(credential, context=self.get_serializer_context()).data)


class CredentialGrantView(CredentialActionView):
    def get(self, request, slug, credential_id):
        credential = self.get_credential()
        if not can_manage(credential, request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(CredentialGrantSerializer(credential.grants.all(), many=True).data)

    def post(self, request, slug, credential_id):
        credential = self.get_credential()
        if not can_manage(credential, request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = CredentialGrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.validated_data["member"]
        if not WorkspaceMember.objects.filter(workspace=self.get_workspace(), member=member, is_active=True).exists():
            return Response(
                {"member": "Member must belong to this workspace."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if serializer.validated_data.get("expires_at") and serializer.validated_data["expires_at"] <= timezone.now():
            return Response(
                {"expires_at": "Expiration must be in the future."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if CredentialGrant.objects.filter(credential=credential, member=member).exists():
            return Response(
                {"member": "Member already has a grant."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        grant = serializer.save(workspace=self.get_workspace(), credential=credential, granted_by=request.user)
        audit(credential, request.user, "grant", request, {"member_id": str(member.id)})
        return Response(CredentialGrantSerializer(grant).data, status=status.HTTP_201_CREATED)


class CredentialGrantDetailView(CredentialActionView):
    def delete(self, request, slug, credential_id, pk):
        credential = self.get_credential()
        if not can_manage(credential, request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        grant = get_object_or_404(CredentialGrant, credential=credential, id=pk)
        member_id = grant.member_id
        grant.delete()
        audit(credential, request.user, "revoke", request, {"member_id": str(member_id)})
        return Response(status=status.HTTP_204_NO_CONTENT)


class CredentialAuditView(CredentialActionView):
    def get(self, request, slug, credential_id):
        credential = self.get_credential()
        if not can_manage(credential, request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        logs = CredentialAccessLog.objects.filter(credential=credential)
        return Response(CredentialAccessLogSerializer(logs, many=True).data)
