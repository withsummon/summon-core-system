# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace
from unittest import mock

import pytest
from django.core.files.storage import InMemoryStorage
from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.test import APIClient

from plane.db.models import FileAsset, Page, Project, ProjectMember, User, WorkspaceMember
from plane.summon.models import AutomationJob, AutomationTemplate, GeneratedArtifact
from plane.summon.services import automation


def create_project_job(workspace, user, identifier="DOC"):
    project = Project.objects.create(workspace=workspace, name="Document Project", identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=20)
    job = AutomationJob.objects.create(
        workspace=workspace,
        project=project,
        requested_by=user,
        type="proposal_client",
        status=AutomationJob.Status.COMPLETED,
        input={"values": {"title": "Client Proposal"}},
        preview_markdown="# Client Proposal\n\nApproved content.",
    )
    return project, job


@pytest.fixture
def memory_file_storage(monkeypatch):
    storage = InMemoryStorage()
    monkeypatch.setattr(FileAsset._meta.get_field("asset"), "storage", storage)
    return storage


@pytest.mark.django_db
def test_default_templates_converge_from_legacy_seed(session_client, workspace):
    legacy = (
        ("Proposal", "proposal"),
        ("Quotation", "quotation"),
        ("Minutes of Meeting", "mom"),
        ("Presentation Outline", "presentation_outline"),
        ("Cost Projection", "cost_projection"),
        ("POC Brief", "poc_brief"),
    )
    for name, template_type in legacy:
        AutomationTemplate.objects.create(
            workspace=workspace,
            name=name,
            type=template_type,
            description=f"LLM-assisted {name}",
            content_template=f"Legacy generic {name} prompt.",
            variables=["title"],
        )

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/automation/templates/")

    assert response.status_code == status.HTTP_200_OK
    assert {item["type"] for item in response.data} == set(automation.DEFAULT_TEMPLATES)
    assert len(response.data) == 13
    assert not AutomationTemplate.objects.filter(
        workspace=workspace,
        type__in=["proposal", "mom", "presentation_outline", "poc_brief"],
        is_active=True,
    ).exists()
    assert (
        "surat quotation formal"
        in AutomationTemplate.objects.get(
            workspace=workspace,
            name="Quotation",
        ).content_template
    )


@pytest.mark.django_db
def test_render_is_idempotent_and_returns_downloadable_file_details(
    session_client,
    workspace,
    create_user,
    monkeypatch,
    memory_file_storage,
):
    project, job = create_project_job(workspace, create_user)
    rendered = [
        SimpleNamespace(
            format="docx",
            filename="client-proposal.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            data=b"docx-content",
        ),
        SimpleNamespace(
            format="pdf",
            filename="client-proposal.pdf",
            content_type="application/pdf",
            data=b"%PDF-approved",
        ),
    ]
    monkeypatch.setattr(automation, "render_document_files", lambda *args: rendered, raising=False)
    url = f"/api/workspaces/{workspace.slug}/summon/automation-jobs/{job.id}/render/"

    first = session_client.post(url, {}, format="json")
    second = session_client.post(url, {}, format="json")

    assert first.status_code == second.status_code == status.HTTP_200_OK
    assert first.data["artifacts"] == second.data["artifacts"]
    files = {item["format"]: item for item in first.data["artifacts"]}
    assert set(files) == {"docx", "pdf"}
    assert files["pdf"]["file_detail"] == {
        "name": "client-proposal.pdf",
        "content_type": "application/pdf",
        "size": len(b"%PDF-approved"),
        "href": f"/api/workspaces/{workspace.slug}/summon/generated-artifacts/{files['pdf']['id']}/download/",
    }
    assert "asset" not in files["pdf"]["file_detail"]
    assert GeneratedArtifact.objects.filter(job=job).count() == 2
    assert FileAsset.objects.filter(entity_type="SUMMON_GENERATED").count() == 2
    pdf_asset = FileAsset.objects.get(id=files["pdf"]["file_asset"])
    assert pdf_asset.workspace == workspace
    assert pdf_asset.project == project
    assert pdf_asset.user == create_user
    assert pdf_asset.entity_identifier == str(job.id)
    assert pdf_asset.attributes == {
        "name": "client-proposal.pdf",
        "type": "application/pdf",
        "size": len(b"%PDF-approved"),
    }
    assert pdf_asset.size == len(b"%PDF-approved")
    assert pdf_asset.is_uploaded is True

    download = session_client.get(files["pdf"]["file_detail"]["href"])

    assert download.status_code == status.HTTP_200_OK
    assert download["Content-Type"] == "application/pdf"
    assert "client-proposal.pdf" in download["Content-Disposition"]
    assert b"".join(download.streaming_content) == b"%PDF-approved"


@pytest.mark.django_db
def test_render_rechecks_requester_and_active_project_role_inside_transaction(
    session_client,
    workspace,
    create_user,
    monkeypatch,
    memory_file_storage,
):
    project, job = create_project_job(workspace, create_user, "LOCK")
    monkeypatch.setattr(
        automation, "render_document_files", lambda *args: pytest.fail("renderer must not run"), raising=False
    )
    ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)

    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/summon/automation-jobs/{job.id}/render/",
        {},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error_code"] == "project_access_revoked"
    assert not GeneratedArtifact.objects.filter(job=job).exists()


@pytest.mark.django_db
def test_generated_file_download_requires_original_requester_and_active_project_role(
    session_client,
    workspace,
    create_user,
    monkeypatch,
    memory_file_storage,
):
    project, job = create_project_job(workspace, create_user, "AUTH")
    monkeypatch.setattr(
        automation,
        "render_document_files",
        lambda *args: [
            SimpleNamespace(
                format="pdf",
                filename="private.pdf",
                content_type="application/pdf",
                data=b"private",
            )
        ],
        raising=False,
    )
    render = session_client.post(
        f"/api/workspaces/{workspace.slug}/summon/automation-jobs/{job.id}/render/",
        {},
        format="json",
    )
    download_url = render.data["artifacts"][0]["file_detail"]["href"]
    other_user = User.objects.create(email="other-document-user@example.com", username="other-document-user")
    WorkspaceMember.objects.create(workspace=workspace, member=other_user, role=20)
    ProjectMember.objects.create(workspace=workspace, project=project, member=other_user, role=20)
    other_client = APIClient()
    other_client.force_authenticate(user=other_user)

    not_requester = other_client.get(download_url)
    ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)
    revoked = session_client.get(download_url)

    assert not_requester.status_code == status.HTTP_404_NOT_FOUND
    assert revoked.status_code == status.HTTP_400_BAD_REQUEST
    assert revoked.data["error_code"] == "project_access_revoked"


@pytest.mark.django_db
def test_native_file_asset_download_reuses_generated_artifact_authorization(
    session_client,
    workspace,
    create_user,
    monkeypatch,
    memory_file_storage,
):
    project, job = create_project_job(workspace, create_user, "NATIVE")
    monkeypatch.setattr(
        automation,
        "render_document_files",
        lambda *args: [
            SimpleNamespace(
                format="pdf",
                filename="native-private.pdf",
                content_type="application/pdf",
                data=b"private",
            )
        ],
    )
    render = session_client.post(
        f"/api/workspaces/{workspace.slug}/summon/automation-jobs/{job.id}/render/",
        {},
        format="json",
    )
    asset_id = render.data["artifacts"][0]["file_asset"]
    other_user = User.objects.create(email="native-outsider@example.com", username="native-outsider")
    WorkspaceMember.objects.create(workspace=workspace, member=other_user, role=20)
    ProjectMember.objects.create(workspace=workspace, project=project, member=other_user, role=20)
    other_client = APIClient()
    other_client.force_authenticate(user=other_user)
    urls = (
        f"/api/assets/v2/workspaces/{workspace.slug}/download/{asset_id}/",
        f"/api/assets/v2/workspaces/{workspace.slug}/projects/{project.id}/download/{asset_id}/",
        f"/api/assets/v2/workspaces/{workspace.slug}/{asset_id}/",
    )

    with mock.patch("plane.app.views.asset.v2.S3Storage") as storage:
        responses = [other_client.get(url) for url in urls]

    assert [response.status_code for response in responses] == [404, 404, 404]
    storage.return_value.generate_presigned_url.assert_not_called()


@pytest.mark.django_db
def test_render_cleans_partially_staged_files_and_is_retryable(
    workspace,
    create_user,
    monkeypatch,
):
    class FailAfterSecondWriteStorage(InMemoryStorage):
        def __init__(self):
            super().__init__()
            self.save_calls = 0

        def _save(self, name, content):
            saved_name = super()._save(name, content)
            self.save_calls += 1
            if self.save_calls == 2:
                raise OSError("second format upload failed")
            return saved_name

    storage = FailAfterSecondWriteStorage()
    monkeypatch.setattr(FileAsset._meta.get_field("asset"), "storage", storage)
    _, job = create_project_job(workspace, create_user, "CLEAN")
    rendered = [
        SimpleNamespace(format="docx", filename="retry.docx", content_type="application/docx", data=b"docx"),
        SimpleNamespace(format="pdf", filename="retry.pdf", content_type="application/pdf", data=b"pdf"),
    ]
    monkeypatch.setattr(automation, "render_document_files", lambda *args: rendered)

    with pytest.raises(OSError, match="second format"):
        automation.render_job_files(job, create_user)

    assert not GeneratedArtifact.objects.filter(job=job).exists()
    assert not FileAsset.objects.filter(entity_identifier=str(job.id)).exists()
    assert storage.listdir(str(workspace.id))[1] == []

    automation.render_job_files(job, create_user)

    assert GeneratedArtifact.objects.filter(job=job).count() == 2
    assert FileAsset.objects.filter(entity_identifier=str(job.id)).count() == 2


@pytest.mark.django_db
def test_render_cleans_staged_files_when_second_database_reservation_fails(
    workspace,
    create_user,
    monkeypatch,
    memory_file_storage,
):
    _, job = create_project_job(workspace, create_user, "DBFAIL")
    rendered = [
        SimpleNamespace(format="docx", filename="retry.docx", content_type="application/docx", data=b"docx"),
        SimpleNamespace(format="pdf", filename="retry.pdf", content_type="application/pdf", data=b"pdf"),
    ]
    monkeypatch.setattr(automation, "render_document_files", lambda *args: rendered)
    artifact_create = GeneratedArtifact.objects.create
    create_calls = 0

    def fail_second_create(**kwargs):
        nonlocal create_calls
        create_calls += 1
        if create_calls == 2:
            raise RuntimeError("second format database reservation failed")
        return artifact_create(**kwargs)

    with mock.patch.object(GeneratedArtifact.objects, "create", side_effect=fail_second_create):
        with pytest.raises(RuntimeError, match="second format"):
            automation.render_job_files(job, create_user)

    assert not GeneratedArtifact.objects.filter(job=job).exists()
    assert not FileAsset.objects.filter(entity_identifier=str(job.id)).exists()
    assert memory_file_storage.listdir(str(workspace.id))[1] == []

    automation.render_job_files(job, create_user)

    assert GeneratedArtifact.objects.filter(job=job).count() == 2
    assert FileAsset.objects.filter(entity_identifier=str(job.id)).count() == 2


@pytest.mark.django_db
@pytest.mark.parametrize("legacy_type", ["proposal", "mom", "presentation_outline", "poc_brief"])
def test_render_rejects_legacy_document_types_with_normalized_error(
    session_client,
    workspace,
    create_user,
    legacy_type,
    memory_file_storage,
):
    _, job = create_project_job(workspace, create_user, f"OLD{legacy_type[:2].upper()}")
    job.type = legacy_type
    job.save(update_fields=["type"])

    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/summon/automation-jobs/{job.id}/render/",
        {},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error_code"] == "unsupported_document_type"
    assert not GeneratedArtifact.objects.filter(job=job).exists()


@pytest.mark.django_db
def test_generated_artifacts_are_unique_per_job_and_format(workspace, create_user):
    project, job = create_project_job(workspace, create_user, "UNIQ")
    first_asset = FileAsset.objects.create(workspace=workspace, project=project, user=create_user, asset="one.pdf")
    second_asset = FileAsset.objects.create(workspace=workspace, project=project, user=create_user, asset="two.docx")
    GeneratedArtifact.objects.create(
        workspace=workspace,
        project=project,
        job=job,
        file_asset=first_asset,
        title="PDF",
        kind=job.type,
        format="pdf",
    )
    GeneratedArtifact.objects.create(
        workspace=workspace,
        project=project,
        job=job,
        file_asset=second_asset,
        title="DOCX",
        kind=job.type,
        format="docx",
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        GeneratedArtifact.objects.create(
            workspace=workspace,
            project=project,
            job=job,
            file_asset=second_asset,
            title="Duplicate",
            kind=job.type,
            format="pdf",
        )

    assert GeneratedArtifact.objects.filter(job=job).count() == 2


@pytest.mark.django_db
def test_generated_artifact_target_must_match_its_format(workspace, create_user):
    project, job = create_project_job(workspace, create_user, "TARGET")
    page = Page.objects.create(workspace=workspace, owned_by=create_user, name="Generated Page")
    asset = FileAsset.objects.create(workspace=workspace, project=project, user=create_user, asset="document.pdf")
    base = {"workspace": workspace, "project": project, "job": job, "title": "Artifact", "kind": job.type}

    with pytest.raises(IntegrityError), transaction.atomic():
        GeneratedArtifact.objects.create(**base, page=page, format="pdf")
    with pytest.raises(IntegrityError), transaction.atomic():
        GeneratedArtifact.objects.create(**base, file_asset=asset, format="page")

    GeneratedArtifact.objects.create(**base, page=page, format="page")
    GeneratedArtifact.objects.create(**base, file_asset=asset, format="pdf")
    assert GeneratedArtifact.objects.filter(job=job).count() == 2


@pytest.mark.django_db
def test_render_service_rejects_incomplete_previews(workspace, create_user, memory_file_storage):
    _, job = create_project_job(workspace, create_user, "STATE")
    job.status = AutomationJob.Status.FAILED
    job.save(update_fields=["status"])

    with pytest.raises(serializers.ValidationError, match="completed preview"):
        automation.render_job_files(job, create_user)
