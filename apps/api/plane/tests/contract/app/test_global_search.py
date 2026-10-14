# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the command palette search (``GlobalSearchEndpoint``)."""

import pytest
from rest_framework import status

from plane.app.views.search.base import GlobalSearchEndpoint
from plane.db.models import Issue, Project, ProjectMember, State


def make_project(workspace, user, identifier, *, member=True):
    project = Project.objects.create(name=f"{identifier} Project", identifier=identifier, workspace=workspace)
    if member:
        ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=20, is_active=True)
    State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace, default=True)
    return project


def make_issue(project, name):
    return Issue.objects.create(name=name, project=project, workspace=project.workspace)


@pytest.fixture
def aura(db, workspace, create_user):
    return make_project(workspace, create_user, "AURA")


@pytest.fixture
def search(session_client, workspace):
    def run(term, **params):
        response = session_client.get(
            f"/api/workspaces/{workspace.slug}/search/",
            {"search": term, "workspace_search": "true", **params},
        )
        assert response.status_code == status.HTTP_200_OK
        return response.data["results"]

    return run


@pytest.mark.contract
@pytest.mark.django_db
class TestGlobalSearch:
    def test_finds_work_items_despite_a_typo(self, search, aura):
        target = make_issue(aura, "Susun rencana pemulihan jadwal Translog")
        make_issue(aura, "Review kontrak vendor")

        issues = search("pemulhan")["issue"]

        assert [issue["id"] for issue in issues] == [target.id]

    def test_ranks_whole_word_matches_above_fuzzy_ones(self, search, aura):
        fuzzy = make_issue(aura, "Susunan tim proyek")
        exact = make_issue(aura, "Susun WBS untuk tahap produksi")

        issues = search("susun")["issue"]

        assert [issue["id"] for issue in issues][:2] == [exact.id, fuzzy.id]

    def test_pins_an_exact_reference_first(self, search, aura):
        make_issue(aura, "Aura credit scoring baseline")
        referenced = make_issue(aura, "Unrelated title")

        issues = search(f"AURA-{referenced.sequence_id}")["issue"]

        assert issues[0]["id"] == referenced.id

    def test_short_number_matches_sequence_ids_only(self, search, aura):
        first = make_issue(aura, "Plan 2 rollout")
        second = make_issue(aura, "Anything")

        issues = search(str(second.sequence_id))["issue"]

        assert [issue["id"] for issue in issues] == [second.id]
        assert first.id not in {issue["id"] for issue in issues}

    def test_short_query_matches_word_starts(self, search, aura):
        word_start = make_issue(aura, "Siapkan dokumen")
        make_issue(aura, "Kontrak bisnis")

        issues = search("si")["issue"]

        assert [issue["id"] for issue in issues] == [word_start.id]

    def test_excludes_projects_the_user_is_not_a_member_of(self, search, workspace, create_user, aura):
        visible = make_issue(aura, "Susun rencana A")
        hidden_project = make_project(workspace, create_user, "HID", member=False)
        make_issue(hidden_project, "Susun rencana B")

        results = search("susun rencana")

        assert [issue["id"] for issue in results["issue"]] == [visible.id]
        assert hidden_project.id not in {project["id"] for project in results["project"]}

    def test_project_scope_limits_results_to_that_project(self, search, workspace, create_user, aura):
        other = make_project(workspace, create_user, "MMF")
        in_scope = make_issue(aura, "Susun development plan")
        make_issue(other, "Susun development plan")

        issues = search("susun development", project_id=str(aura.id), workspace_search="false")["issue"]

        assert [issue["id"] for issue in issues] == [in_scope.id]

    def test_caps_work_item_results(self, search, aura):
        for index in range(GlobalSearchEndpoint.ISSUE_LIMIT + 5):
            make_issue(aura, f"Susun laporan {index}")

        assert len(search("susun")["issue"]) == GlobalSearchEndpoint.ISSUE_LIMIT
