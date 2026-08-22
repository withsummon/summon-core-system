# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectEntityPermission
from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import Project, Workspace
from plane.summon.models import Client, ClientContact, Opportunity, SummonProjectProfile
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers import (
    ClientContactSerializer,
    ClientDetailSerializer,
    ClientSerializer,
    OpportunityDetailSerializer,
    OpportunitySerializer,
    OpportunityTransitionSerializer,
    SummonProjectProfileSerializer,
)
from plane.summon.services.commercial import transition_opportunity


class WorkspaceContextMixin:
    def get_workspace(self):
        return get_object_or_404(Workspace, slug=self.kwargs["slug"], deleted_at__isnull=True)

    def get_serializer_context(self):
        return {
            "request": self.request,
            "format": self.format_kwarg,
            "view": self,
            "workspace": self.get_workspace(),
        }


class ClientViewSet(WorkspaceContextMixin, BaseViewSet):
    model = Client
    serializer_class = ClientSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        return Client.objects.filter(workspace__slug=self.kwargs["slug"], workspace__deleted_at__isnull=True).order_by(
            "name"
        )

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace())

    def get_serializer_class(self):
        return ClientDetailSerializer if self.action == "retrieve" else ClientSerializer


class ClientContactViewSet(WorkspaceContextMixin, BaseViewSet):
    model = ClientContact
    serializer_class = ClientContactSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_client(self):
        return get_object_or_404(
            Client,
            id=self.kwargs["client_id"],
            workspace__slug=self.kwargs["slug"],
            workspace__deleted_at__isnull=True,
        )

    def get_queryset(self):
        return ClientContact.objects.filter(
            workspace__slug=self.kwargs["slug"],
            workspace__deleted_at__isnull=True,
            client=self.get_client(),
        ).order_by("name")

    def create(self, request, *args, **kwargs):
        self.get_client()
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace(), client=self.get_client())


class OpportunityViewSet(WorkspaceContextMixin, BaseViewSet):
    model = Opportunity
    serializer_class = OpportunitySerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        return Opportunity.objects.filter(
            workspace__slug=self.kwargs["slug"], workspace__deleted_at__isnull=True
        ).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace())

    def get_serializer_class(self):
        return OpportunityDetailSerializer if self.action == "retrieve" else OpportunitySerializer


class OpportunityTransitionView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def post(self, request, slug, pk):
        opportunity = get_object_or_404(
            Opportunity,
            id=pk,
            workspace__slug=slug,
            workspace__deleted_at__isnull=True,
        )
        serializer = OpportunityTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transition_opportunity(opportunity, actor=request.user, **serializer.validated_data)
        return Response(
            OpportunityDetailSerializer(opportunity, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )


class SummonProjectProfileView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission, ProjectEntityPermission]

    def get_project(self):
        return get_object_or_404(
            Project,
            id=self.kwargs["project_id"],
            workspace__slug=self.kwargs["slug"],
            workspace__deleted_at__isnull=True,
        )

    def get_profile(self):
        return get_object_or_404(
            SummonProjectProfile,
            project=self.get_project(),
            workspace__slug=self.kwargs["slug"],
            workspace__deleted_at__isnull=True,
        )

    def get(self, request, slug, project_id):
        profile = self.get_profile()
        return Response(SummonProjectProfileSerializer(profile, context=self.get_serializer_context()).data)

    def post(self, request, slug, project_id):
        project = self.get_project()
        serializer = SummonProjectProfileSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        serializer.save(workspace=self.get_workspace(), project=project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request, slug, project_id):
        profile = self.get_profile()
        serializer = SummonProjectProfileSerializer(
            profile,
            data=request.data,
            partial=True,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
