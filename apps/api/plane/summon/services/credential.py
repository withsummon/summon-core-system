# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from cryptography.fernet import Fernet, InvalidToken
from rest_framework import serializers

from plane.summon.models import CredentialAccessLog, CredentialGrant


MASKED_SECRET = "••••••••"


def _fernet():
    key = getattr(settings, "SUMMON_CREDENTIAL_KEY", None)
    if not key:
        raise serializers.ValidationError({"secret": "Credential encryption is not configured."})
    try:
        return Fernet(key.encode())
    except (TypeError, ValueError) as exc:
        raise serializers.ValidationError({"secret": "Credential encryption is not configured."}) from exc


def encrypt_secret(secret):
    return f"v1:{_fernet().encrypt(secret.encode()).decode()}"


def decrypt_secret(ciphertext):
    version, separator, token = ciphertext.partition(":")
    if version != "v1" or not separator:
        raise serializers.ValidationError({"secret": "Unsupported credential key version."})
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise serializers.ValidationError({"secret": "Credential cannot be decrypted."}) from exc


def active_grants(credential, member):
    now = timezone.now()
    return CredentialGrant.objects.filter(credential=credential, member=member).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    )


def can_reveal(credential, member):
    return (
        credential.owner_id == member.id
        or active_grants(credential, member)
        .filter(permission__in=[CredentialGrant.Permission.VIEW, CredentialGrant.Permission.MANAGE])
        .exists()
    )


def can_manage(credential, member):
    return (
        credential.owner_id == member.id
        or active_grants(credential, member).filter(permission=CredentialGrant.Permission.MANAGE).exists()
    )


def verify_password(credential, request, action):
    password = request.data.get("password")
    if not password or not request.user.check_password(password):
        audit(credential, request.user, f"{action}_denied", request)
        raise serializers.ValidationError({"password": "Current password is required."})


def audit(credential, member, action, request=None, metadata=None):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "") if request else ""
    ip_address = (forwarded.split(",", 1)[0].strip() or request.META.get("REMOTE_ADDR")) if request else None
    return CredentialAccessLog.objects.create(
        workspace=credential.workspace,
        credential=credential,
        member=member,
        action=action,
        metadata=metadata or {},
        ip_address=ip_address or None,
        user_agent=request.META.get("HTTP_USER_AGENT", "") if request else "",
    )
