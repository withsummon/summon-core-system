# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import Issue, Page, ProjectMember
from plane.summon.models import Meeting, MeetingWorkItem, ResourceLink, SummonPageContext
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers.collaboration import (
    MeetingSerializer,
    MeetingWorkItemSerializer,
    ResourceLinkSerializer,
    SummonPageContextSerializer,
)
from plane.summon.services.collaboration import link_work_item
from plane.summon.views.commercial import WorkspaceContextMixin


def accessible_project_ids(request, slug, write=False):
    roles = [20, 15] if write else [20, 15, 5]
    return ProjectMember.objects.filter(
        workspace__slug=slug,
        workspace__deleted_at__isnull=True,
        project__deleted_at__isnull=True,
        member=request.user,
        role__in=roles,
        is_active=True,
    ).values_list("project_id", flat=True)


def accessible_page_ids(request, slug, write=False):
    project_ids = accessible_project_ids(request, slug, write)
    return Page.objects.filter(workspace__slug=slug).filter(
        Q(owned_by=request.user)
        | Q(access=Page.PUBLIC_ACCESS, is_global=True)
        | Q(access=Page.PUBLIC_ACCESS, projects__id__in=project_ids)
    )


class MeetingViewSet(WorkspaceContextMixin, BaseViewSet):
    model = Meeting
    serializer_class = MeetingSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        project_ids = accessible_project_ids(self.request, self.kwargs["slug"], self.request.method not in SAFE_METHODS)
        return (
            Meeting.objects.filter(
                workspace__slug=self.kwargs["slug"],
                workspace__deleted_at__isnull=True,
            )
            .filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
            .select_related(
                "project",
                "recording_asset",
                "transcript_asset",
                "summary_page",
            )
            .prefetch_related("participants__member")
        )


class MeetingWorkItemView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get_meeting(self):
        project_ids = accessible_project_ids(self.request, self.kwargs["slug"], self.request.method not in SAFE_METHODS)
        return get_object_or_404(
            Meeting.objects.filter(
                workspace__slug=self.kwargs["slug"],
                workspace__deleted_at__isnull=True,
            ).filter(Q(project__isnull=True) | Q(project_id__in=project_ids)),
            id=self.kwargs["meeting_id"],
        )

    def get(self, request, slug, meeting_id):
        items = MeetingWorkItem.objects.filter(
            meeting=self.get_meeting(),
            issue__deleted_at__isnull=True,
            issue__project_id__in=accessible_project_ids(request, slug),
        ).select_related("issue__state", "issue__project")
        return Response(MeetingWorkItemSerializer(items, many=True).data)

    def post(self, request, slug, meeting_id):
        meeting = self.get_meeting()
        issue = get_object_or_404(
            Issue,
            id=request.data.get("issue"),
            workspace__slug=slug,
            workspace__deleted_at__isnull=True,
        )
        item = link_work_item(meeting, issue, request.user)
        return Response(MeetingWorkItemSerializer(item).data, status=status.HTTP_201_CREATED)


class MeetingWorkItemDetailView(MeetingWorkItemView):
    def delete(self, request, slug, meeting_id, pk):
        item = get_object_or_404(MeetingWorkItem, id=pk, meeting=self.get_meeting())
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SummonPageContextViewSet(WorkspaceContextMixin, BaseViewSet):
    model = SummonPageContext
    serializer_class = SummonPageContextSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        write = self.request.method not in SAFE_METHODS
        project_ids = accessible_project_ids(self.request, self.kwargs["slug"], write)
        accessible_pages = accessible_page_ids(self.request, self.kwargs["slug"], write)
        return (
            SummonPageContext.objects.filter(
                workspace__slug=self.kwargs["slug"],
                workspace__deleted_at__isnull=True,
                page__in=accessible_pages,
            )
            .filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
            .select_related("page", "project", "client", "opportunity")
            .distinct()
        )

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace())


class ResourceLinkViewSet(WorkspaceContextMixin, BaseViewSet):
    model = ResourceLink
    serializer_class = ResourceLinkSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        write = self.request.method not in SAFE_METHODS
        project_ids = accessible_project_ids(self.request, self.kwargs["slug"], write)
        page_ids = accessible_page_ids(self.request, self.kwargs["slug"], write)
        return (
            ResourceLink.objects.filter(
                workspace__slug=self.kwargs["slug"],
                workspace__deleted_at__isnull=True,
            )
            .filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
            .filter(Q(page__isnull=True) | Q(page_id__in=page_ids))
            .select_related("project", "page", "client", "credential")
        )

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace())
