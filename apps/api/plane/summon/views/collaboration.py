# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework import status
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

from plane.app.services.llm import LLMError
from plane.summon.views.base import SummonAPIView, SummonViewSet
from plane.db.models import Issue, Page, ProjectMember
from plane.summon.models import Meeting, MeetingWorkItem, ResourceLink, SummonPageContext
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers.collaboration import (
    MEETING_READ_PREFETCH,
    MEETING_READ_RELATED,
    MeetingSerializer,
    MeetingWorkItemSerializer,
    ResourceLinkSerializer,
    SummonPageContextSerializer,
)
from plane.summon.serializers.operations import MeetingSummaryRequestSerializer, PageFilterSerializer
from plane.summon.serializers.shapes import (
    ErrorCodeSerializer,
    MeetingWorkItemReadSerializer,
    PageReadSerializer,
    PageSummarySerializer,
)
from plane.summon.services.collaboration import link_work_item
from plane.summon.services.commercial import accessible_pages
from plane.summon.services.context import page_href, page_text
from plane.summon.services.reports import visible_project_ids
from plane.summon.services.meeting_summary import summarize_meeting
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


class MeetingViewSet(WorkspaceContextMixin, SummonViewSet):
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
            .select_related(*MEETING_READ_RELATED)
            .prefetch_related(*MEETING_READ_PREFETCH)
        )


class MeetingWorkItemView(WorkspaceContextMixin, SummonAPIView):
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

    @extend_schema(
        description="List the Plane work items linked to a meeting.",
        responses={200: MeetingWorkItemReadSerializer(many=True)},
    )
    def get(self, request, slug, meeting_id):
        items = MeetingWorkItem.objects.filter(
            meeting=self.get_meeting(),
            issue__deleted_at__isnull=True,
            issue__project_id__in=accessible_project_ids(request, slug),
        ).select_related("issue__state", "issue__project")
        return Response(MeetingWorkItemSerializer(items, many=True).data)

    @extend_schema(
        description="Link a Plane work item to a meeting.",
        request=inline_serializer("MeetingWorkItemLinkRequest", {"issue": serializers.UUIDField()}),
        responses={201: MeetingWorkItemReadSerializer},
    )
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


class MeetingSummaryFailureSerializer(MeetingSerializer):
    """Schema only: the meeting as saved, plus the provider error code."""

    error_code = serializers.CharField()

    class Meta(MeetingSerializer.Meta):
        fields = [*MeetingSerializer.Meta.fields, "error_code"]


class MeetingSummaryView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get_meeting(self):
        return get_object_or_404(
            Meeting.objects.filter(
                workspace__slug=self.kwargs["slug"],
                workspace__deleted_at__isnull=True,
            ).filter(
                Q(project__isnull=True)
                | Q(project_id__in=accessible_project_ids(self.request, self.kwargs["slug"], write=True))
            ),
            id=self.kwargs["meeting_id"],
        )

    @extend_schema(
        summary="Summarize meeting",
        description="Generate minutes for a meeting from its transcript or notes. Slow: runs the AI model.",
        request=MeetingSummaryRequestSerializer,
        responses={200: MeetingSerializer, 400: ErrorCodeSerializer, 503: MeetingSummaryFailureSerializer},
    )
    def post(self, request, slug, meeting_id):
        serializer = MeetingSummaryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting = self.get_meeting()
        if not meeting.project_id:
            return Response(
                {
                    "error_code": "project_required",
                    "project": "Link an authorized Plane Project before generating a summary.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            meeting = summarize_meeting(
                meeting,
                request.user,
                serializer.validated_data["context"],
                serializer.validated_data.get("transcript_source"),
            )
        except LLMError as error:
            meeting.refresh_from_db()
            data = dict(MeetingSerializer(meeting, context=self.get_serializer_context()).data)
            data["error_code"] = error.code
            return Response(data, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(MeetingSerializer(meeting, context=self.get_serializer_context()).data)


class MeetingWorkItemDetailView(MeetingWorkItemView):
    http_method_names = ["delete", "options"]  # list and link live on MeetingWorkItemView

    @extend_schema(description="Unlink a work item from a meeting.", responses={204: None})
    def delete(self, request, slug, meeting_id, pk):
        item = get_object_or_404(MeetingWorkItem, id=pk, meeting=self.get_meeting())
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SummonPageContextViewSet(WorkspaceContextMixin, SummonViewSet):
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


class ResourceLinkViewSet(WorkspaceContextMixin, SummonViewSet):
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
            .select_related("project", "page", "client", "credential", "created_by", "updated_by")
            .order_by("-updated_at")
        )

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(
            workspace=self.get_workspace(),
            created_by=user,
            updated_by=user,
        )

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(
            updated_by=user,
        )


PAGE_LIST_LIMIT = 50
PAGE_TEXT_LIMIT = 50_000


class PageView(WorkspaceContextMixin, SummonAPIView):
    """Plane Pages the user can read, so agents can use meeting notes and project docs, not only their names."""

    permission_classes = [SummonWorkspacePermission]

    def visible_pages(self):
        workspace = self.get_workspace()
        project_ids = set(visible_project_ids(workspace, self.request.user))
        pages = (
            accessible_pages(workspace, self.request.user, project_ids)
            .filter(archived_at__isnull=True)
            .prefetch_related("projects")
            .distinct()
        )
        return workspace, project_ids, pages

    def summary(self, workspace, project_ids, page):
        return {
            "id": page.id,
            "name": page.name,
            "project_ids": [project.id for project in page.projects.all() if project.id in project_ids],
            "updated_at": page.updated_at,
            "href": page_href(workspace, page, project_ids),
        }


class PageListView(PageView):
    @extend_schema(
        description=(
            f"List the Plane Pages you can read, newest first (at most {PAGE_LIST_LIMIT}). Use page_get to read one."
        ),
        parameters=[PageFilterSerializer],
        responses={200: PageSummarySerializer(many=True)},
    )
    def get(self, request, slug):
        filters = PageFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        workspace, project_ids, pages = self.visible_pages()
        if "project_id" in filters.validated_data:
            pages = pages.filter(projects__id=filters.validated_data["project_id"])
        if "search" in filters.validated_data:
            pages = pages.filter(name__icontains=filters.validated_data["search"])
        pages = pages.order_by("-updated_at")[:PAGE_LIST_LIMIT]
        return Response([self.summary(workspace, project_ids, page) for page in pages])


class PageDetailView(PageView):
    @extend_schema(
        description="Read one Plane Page you can see: its text, such as meeting notes or a project doc.",
        responses={200: PageReadSerializer, 404: None},
    )
    def get(self, request, slug, pk):
        workspace, project_ids, pages = self.visible_pages()
        page = get_object_or_404(pages, pk=pk)
        text = page_text(page)
        return Response(
            {
                **self.summary(workspace, project_ids, page),
                "content": text[:PAGE_TEXT_LIMIT],
                "truncated": len(text) > PAGE_TEXT_LIMIT,
            }
        )
