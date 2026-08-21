# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.summon.views import (
    ClientContactViewSet,
    ClientViewSet,
    OpportunityTransitionView,
    OpportunityViewSet,
    SummonProjectProfileView,
)


client_list = ClientViewSet.as_view({"get": "list", "post": "create"})
client_detail = ClientViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
contact_list = ClientContactViewSet.as_view({"get": "list", "post": "create"})
contact_detail = ClientContactViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
opportunity_list = OpportunityViewSet.as_view({"get": "list", "post": "create"})
opportunity_detail = OpportunityViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})

urlpatterns = [
    path("workspaces/<str:slug>/clients/", client_list, name="summon-client-list"),
    path("workspaces/<str:slug>/clients/<uuid:pk>/", client_detail, name="summon-client-detail"),
    path(
        "workspaces/<str:slug>/clients/<uuid:client_id>/contacts/",
        contact_list,
        name="summon-client-contact-list",
    ),
    path(
        "workspaces/<str:slug>/clients/<uuid:client_id>/contacts/<uuid:pk>/",
        contact_detail,
        name="summon-client-contact-detail",
    ),
    path("workspaces/<str:slug>/opportunities/", opportunity_list, name="summon-opportunity-list"),
    path(
        "workspaces/<str:slug>/opportunities/<uuid:pk>/",
        opportunity_detail,
        name="summon-opportunity-detail",
    ),
    path(
        "workspaces/<str:slug>/opportunities/<uuid:pk>/transitions/",
        OpportunityTransitionView.as_view(),
        name="summon-opportunity-transition",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/profile/",
        SummonProjectProfileView.as_view(),
        name="summon-project-profile",
    ),
]
