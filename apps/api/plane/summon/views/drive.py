# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from hmac import compare_digest
from urllib.parse import urlencode

from django.core import signing
from django.db.models import Count, Q
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from plane.db.models import WorkspaceMember
from plane.summon.models import Credential, DriveFolder
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers.collaboration import DriveFolderConnectSerializer, DriveFolderSerializer
from plane.summon.serializers.shapes import ErrorCodeSerializer
from plane.summon.services.credential import audit, can_use
from plane.summon.services.google_drive import (
    CONVERTERS,
    FOLDER_MIME,
    GOOGLE_DRIVE_PROVIDER,
    GoogleDriveError,
    authorization_url,
    disconnect_drive_folder,
    drive_client,
    exchange_code,
    parse_drive_id,
    record_drive_error,
    run_drive_sync,
    save_google_account,
    watch_drive_folder,
)
from plane.summon.tasks import sync_drive_changes
from plane.summon.views.base import SESSION_ONLY_AUTHENTICATION, SummonAPIView
from plane.summon.views.collaboration import accessible_project_ids
from plane.summon.views.commercial import WorkspaceContextMixin
from plane.utils.host import base_host

CALLBACK_PATH = "/api/summon/google-drive/callback/"
STATE_SALT = "summon.google-drive.connect"
# Long enough to pick an account and read the consent screen; a stolen state goes stale soon after.
STATE_MAX_AGE_SECONDS = 600


def _error(error):
    return Response(
        {"error_code": error.code},
        status=status.HTTP_502_BAD_GATEWAY if error.code == "drive_unavailable" else status.HTTP_400_BAD_REQUEST,
    )


def _folders(workspace, project_ids):
    return (
        DriveFolder.objects.filter(workspace=workspace, project_id__in=project_ids)
        .select_related("credential")
        .annotate(file_count=Count("files", filter=Q(files__page__archived_at__isnull=True)))
    )


def _ensure_watched(folder):
    if not folder.channel_id:
        try:
            watch_drive_folder(folder)
        except GoogleDriveError as error:
            record_drive_error(folder, error)


def _back_to_knowledge(request, slug, **params):
    return HttpResponseRedirect(
        f"{base_host(request=request, is_app=True).rstrip('/')}/{slug}/summon/knowledge/?{urlencode(params)}"
    )


class GoogleDriveConnectView(WorkspaceContextMixin, SummonAPIView):
    """Send the browser to Google to grant read-only Drive access; Google returns it to the callback below."""

    authentication_classes = SESSION_ONLY_AUTHENTICATION
    permission_classes = [SummonWorkspacePermission]
    summon_tool = "none"

    @extend_schema(exclude=True)
    def get(self, request, slug):
        self.get_workspace()
        # Signed for this person: a callback carrying someone else's state cannot attach a Google account to them.
        state = signing.dumps({"workspace": slug, "member": str(request.user.id)}, salt=STATE_SALT)
        try:
            return HttpResponseRedirect(authorization_url(request.build_absolute_uri(CALLBACK_PATH), state))
        except GoogleDriveError as error:
            return _back_to_knowledge(request, slug, drive_error=error.code)


class GoogleDriveCallbackView(SummonAPIView):
    authentication_classes = SESSION_ONLY_AUTHENTICATION
    permission_classes = []
    summon_tool = "none"

    @extend_schema(exclude=True)
    def get(self, request):
        try:
            state = signing.loads(request.GET.get("state", ""), salt=STATE_SALT, max_age=STATE_MAX_AGE_SECONDS)
        except signing.BadSignature:
            return Response({"error_code": "drive_state_invalid"}, status=status.HTTP_400_BAD_REQUEST)
        slug = state["workspace"]
        member = (
            WorkspaceMember.objects.filter(
                workspace__slug=slug,
                workspace__deleted_at__isnull=True,
                member_id=request.user.id,
                is_active=True,
            )
            .select_related("workspace")
            .first()
        )
        if not request.user.is_authenticated or str(request.user.id) != state["member"] or not member:
            return Response({"error_code": "drive_state_invalid"}, status=status.HTTP_400_BAD_REQUEST)
        if request.GET.get("error") or not request.GET.get("code"):
            # Google sends `error=access_denied` when the person cancels the consent screen.
            return _back_to_knowledge(request, slug, drive_error="drive_access_not_granted")
        try:
            email, refresh_token = exchange_code(request.GET["code"], request.build_absolute_uri(CALLBACK_PATH))
        except GoogleDriveError as error:
            return _back_to_knowledge(request, slug, drive_error=error.code)
        credential = save_google_account(member.workspace, request.user, email, refresh_token)
        audit(credential, request.user, "connect", request, {"purpose": "google_drive"})
        # Reconnecting after a revocation: the folders on this account pick up what changed while it was cut off.
        broken = list(credential.drive_folders.exclude(sync_error="").values_list("id", flat=True))
        DriveFolder.objects.filter(id__in=broken).update(sync_error="")
        for folder_id in broken:
            sync_drive_changes.delay(str(folder_id))
        return _back_to_knowledge(request, slug, drive="connected")


class DriveFolderListView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]
    summon_tool = "none"  # reads Drive as a person's Google account; connecting stays with people in the app

    @extend_schema(
        summary="List synced Google Drive folders and files",
        description="Drive folders and files synced into the projects you can access, with their sync health.",
        responses={200: DriveFolderSerializer(many=True)},
    )
    def get(self, request, slug):
        folders = _folders(self.get_workspace(), accessible_project_ids(request, slug))
        return Response(DriveFolderSerializer(folders, many=True).data)

    @extend_schema(
        summary="Sync a Google Drive folder or file",
        description=(
            "Copy a Drive folder's Docs, Sheets and Slides, subfolders included, or a single Doc, Sheet or Slides "
            "file, into locked pages of `project`, and keep them current as the files change. The credential's Google "
            "account must be able to open it."
        ),
        request=DriveFolderConnectSerializer,
        responses={
            201: DriveFolderSerializer,
            400: ErrorCodeSerializer,
            409: ErrorCodeSerializer,
            502: ErrorCodeSerializer,
        },
    )
    def post(self, request, slug):
        payload = DriveFolderConnectSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        workspace = self.get_workspace()
        credential = Credential.objects.filter(
            workspace=workspace,
            id=payload.validated_data["credential"],
            provider=GOOGLE_DRIVE_PROVIDER,
            status=Credential.Status.ACTIVE,
        ).first()
        if not credential or not can_use(credential, request.user):
            return Response({"error_code": "drive_credential_required"}, status=status.HTTP_400_BAD_REQUEST)
        project_ids = accessible_project_ids(request, slug, write=True)
        if not project_ids.filter(project_id=payload.validated_data["project"]).exists():
            return Response({"error_code": "project_required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            folder_id = parse_drive_id(payload.validated_data["folder"])
            client = drive_client(credential)
            item = client.item(folder_id)
            if item["mimeType"] != FOLDER_MIME and item["mimeType"] not in CONVERTERS:
                # PDFs, images and uploads have no text export to keep a page in step with.
                raise GoogleDriveError("drive_file_unsupported")
        except GoogleDriveError as error:
            return _error(error)
        audit(credential, request.user, "use", request, {"purpose": "google_drive_sync", "folder": folder_id})
        folder = DriveFolder.objects.create(
            workspace=workspace,
            project_id=payload.validated_data["project"],
            credential=credential,
            kind=DriveFolder.Kind.FOLDER if item["mimeType"] == FOLDER_MIME else DriveFolder.Kind.FILE,
            folder_id=folder_id,
            name=item["name"],
            drive_id=item.get("driveId", ""),
        )
        # The connection stands even if the first import fails; its row shows the error and "Sync now" retries.
        _ensure_watched(run_drive_sync(folder.id, full=True))
        return Response(
            DriveFolderSerializer(_folders(workspace, project_ids).get(id=folder.id)).data,
            status=status.HTTP_201_CREATED,
        )


class DriveFolderDetailView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]
    summon_tool = "none"

    @extend_schema(
        summary="Stop syncing a Google Drive folder or file",
        description="Stop following it in Drive. Its pages stay, unlocked, as ordinary pages.",
        responses={204: None},
    )
    def delete(self, request, slug, folder_id):
        folder = get_object_or_404(
            DriveFolder,
            workspace=self.get_workspace(),
            id=folder_id,
            project_id__in=accessible_project_ids(request, slug, write=True),
        )
        disconnect_drive_folder(folder)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DriveFolderSyncView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]
    summon_tool = "none"

    @extend_schema(
        summary="Sync a Google Drive folder or file now",
        description="Compare every page with its Drive file now, instead of waiting for the next change.",
        request=None,
        responses={200: DriveFolderSerializer},
    )
    def post(self, request, slug, folder_id):
        workspace = self.get_workspace()
        project_ids = accessible_project_ids(request, slug, write=True)
        folder = get_object_or_404(DriveFolder, workspace=workspace, id=folder_id, project_id__in=project_ids)
        _ensure_watched(run_drive_sync(folder.id, full=True))
        return Response(DriveFolderSerializer(_folders(workspace, project_ids).get(id=folder.id)).data)


class DriveNotificationView(SummonAPIView):
    """Google Drive's push channel. Drive signs nothing; the channel token we chose proves the call is ours."""

    summon_tool = "none"
    authentication_classes = []
    permission_classes = []

    @extend_schema(exclude=True)
    def post(self, request):
        # Sources without a push channel have an empty channel ID and token, which must not match a bare request.
        channel_id = request.headers.get("X-Goog-Channel-ID")
        folder = DriveFolder.objects.filter(channel_id=channel_id).first() if channel_id else None
        if (
            folder
            and compare_digest(folder.channel_token, request.headers.get("X-Goog-Channel-Token", ""))
            # "sync" only confirms a new channel; anything else means the feed moved.
            and request.headers.get("X-Goog-Resource-State") != "sync"
        ):
            sync_drive_changes.delay(str(folder.id))
        # Unknown and stale channels get a success too: an error would only make Drive retry them.
        return Response(status=status.HTTP_204_NO_CONTENT)
