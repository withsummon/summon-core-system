# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
from io import BytesIO
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import jwt
import openpyxl
import pytest
from cryptography.fernet import Fernet
from rest_framework import status
from rest_framework.test import APIClient

from plane.bgtasks import copy_s3_object
from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember
from plane.summon import tasks
from plane.summon.models import Credential, DriveFile, DriveFolder
from plane.summon.services import google_drive
from plane.summon.services.credential import decrypt_secret
from plane.summon.views import drive as drive_views

ROOT, SUB = "rootFolder0001", "subFolder00001"
SOLO, LOOSE_PDF = "soloDocument01", "loosePdfFile01"
GOOGLE_EMAIL = "val@client-x.com"


def _paragraph(*runs, style="NORMAL_TEXT", bullet=None):
    paragraph = {
        "elements": [{"textRun": {"content": text, "textStyle": text_style}} for text, text_style in runs],
        "paragraphStyle": {"namedStyleType": style},
    }
    return {"paragraph": {**paragraph, "bullet": bullet} if bullet else paragraph}


def _doc(*tabs):
    """A Docs API document; each tab is (title, content). The only list is bulleted then numbered."""
    lists = {"l1": {"listProperties": {"nestingLevels": [{"glyphSymbol": "●"}, {"glyphType": "DECIMAL"}]}}}
    return {
        "tabs": [
            {"tabProperties": {"title": title}, "documentTab": {"lists": lists, "body": {"content": content}}}
            for title, content in tabs
        ]
    }


PLAN_DOC = _doc(
    (
        "Tab 1",
        [
            {"sectionBreak": {}},
            _paragraph(("Plan\n", {}), style="HEADING_1"),
            _paragraph(("Ship", {"bold": True}), (" ", {}), ("spec\n", {"link": {"url": "https://example.com/spec"}})),
            _paragraph(("\n", {})),
            _paragraph(("\ue907\n", {})),
            _paragraph(("One\n", {}), bullet={"listId": "l1"}),
            _paragraph(("Two\n", {}), bullet={"listId": "l1", "nestingLevel": 1}),
            _paragraph(("Three <b>\n", {"italic": True}), bullet={"listId": "l1"}),
            {"table": {"tableRows": [{"tableCells": [{"content": [_paragraph(("Cell\n", {}))]}, {"content": []}]}]}},
        ],
    )
)


def _xlsx():
    workbook = openpyxl.Workbook()
    workbook.active.title = "Budget"
    workbook.active.append(["Item", "Cost"])
    workbook.active.append(["Printer", 1200])
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _file(file_id, name, mime, parent=ROOT, modified="2026-10-01T00:00:00.000Z"):
    return {
        "id": file_id,
        "name": name,
        "mimeType": mime,
        "modifiedTime": modified,
        "parents": [parent],
        "webViewLink": f"https://docs.google.com/{file_id}",
    }


class FakeDrive(google_drive.DriveClient):
    """Drive as the connected account sees it: one folder with a subfolder, a Doc and a PDF outside it, and a
    change feed. The folder walk is the real client's. `revoked` plays the person withdrawing Summon's access in
    their Google account."""

    tree = {
        ROOT: [
            _file("doc", "Plan", "application/vnd.google-apps.document"),
            _file("sheet", "Budget", "application/vnd.google-apps.spreadsheet"),
            _file("pdf", "Scan.pdf", "application/pdf"),
            _file(SUB, "Archive", google_drive.FOLDER_MIME),
        ],
        SUB: [_file("slides", "Kickoff", "application/vnd.google-apps.presentation", parent=SUB)],
    }
    loose = {
        SOLO: _file(SOLO, "Brief", "application/vnd.google-apps.document", parent="elsewhere"),
        LOOSE_PDF: _file(LOOSE_PDF, "Invoice.pdf", "application/pdf", parent="elsewhere"),
    }
    exports = {"sheet": _xlsx(), "slides": b"Kickoff\n\nGoals"}
    documents = {
        "doc": PLAN_DOC,
        SOLO: _doc(("Scope", [_paragraph(("Scope\n", {}))]), ("Notes", [_paragraph(("Later\n", {}))])),
    }
    feed = []
    watched = []
    stopped = []
    revoked = False

    def item(self, item_id):
        if item_id == ROOT:
            return {"id": ROOT, "name": "Client X", "mimeType": google_drive.FOLDER_MIME}
        if item_id in self.loose:
            return self.loose[item_id]
        raise google_drive.GoogleDriveError("drive_not_found")

    def children(self, folder_id):
        return iter(self.tree.get(folder_id, []))

    def start_page_token(self, drive_id):
        return "token-1"

    def changes(self, page_token, drive_id):
        if self.revoked:
            raise google_drive.GoogleDriveError("drive_auth_revoked")
        return self.feed, "token-2"

    def export(self, file_id, mime_type):
        return self.exports[file_id]

    def document(self, file_id):
        return self.documents[file_id]

    def watch(self, page_token, drive_id, channel_id, channel_token, address, expires_at):
        self.watched.append(address)
        return {"resourceId": f"resource-{channel_id}"}

    def stop(self, channel_id, resource_id):
        self.stopped.append(channel_id)


def _google_token(scope=f"openid email {google_drive.DRIVE_SCOPE}"):
    """What Google's token endpoint answers for an authorization code."""
    return {
        "access_token": "access",
        "refresh_token": f"refresh-{uuid4().hex}",
        "scope": scope,
        "id_token": jwt.encode({"email": GOOGLE_EMAIL}, "google-signs-this-with-its-own-key", algorithm="HS256"),
    }


@pytest.fixture
def drive(settings, monkeypatch, workspace):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    settings.WEB_URL = "https://summon.example"
    settings.APP_BASE_URL = "https://app.summon.example"
    settings.SKIP_ENV_VAR = False
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setattr(google_drive, "DriveClient", FakeDrive)
    for name, value in {"feed": [], "watched": [], "stopped": [], "revoked": False}.items():
        monkeypatch.setattr(FakeDrive, name, value)
    sent = []
    monkeypatch.setattr(
        copy_s3_object,
        "sync_with_external_service",
        lambda _entity, html: (
            sent.append(html)
            or {
                "description_json": {"type": "doc", "content": [{"type": "paragraph"}]},
                "description_binary": base64.b64encode(b"drive-page").decode(),
            }
        ),
    )
    identity = uuid4().hex
    user = User.objects.create(email=f"drive-{identity}@plane.test", username=f"drive_{identity}")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=20)
    project = Project.objects.create(workspace=workspace, name="Client X", identifier="CLX")
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=20)
    api = APIClient()
    api.force_login(user)
    return api, user, project, sent


def _connect_google(api, monkeypatch, slug, token):
    """Walk the consent round trip: Summon sends the browser to Google, Google sends it back with a code."""
    started = api.get(f"/api/summon/workspaces/{slug}/google-drive/connect/")
    assert started.status_code == status.HTTP_302_FOUND
    consent = parse_qs(urlparse(started["Location"]).query)
    monkeypatch.setattr(google_drive, "_token_request", lambda data: token)
    return consent, api.get("/api/summon/google-drive/callback/", {"state": consent["state"][0], "code": "code"})


@pytest.mark.django_db
def test_google_account_syncs_folder_into_locked_pages_and_warns_when_access_is_revoked(workspace, drive, monkeypatch):
    api, user, project, sent = drive
    base = f"/api/summon/workspaces/{workspace.slug}"
    knowledge = f"https://app.summon.example/{workspace.slug}/summon/knowledge/"

    # Unticking Drive on Google's consent screen still finishes sign-in, but leaves nothing to sync with.
    _, partial = _connect_google(api, monkeypatch, workspace.slug, _google_token(scope="openid email"))
    assert partial["Location"] == f"{knowledge}?drive_error=drive_scope_missing"

    token = _google_token()
    consent, connected_google = _connect_google(api, monkeypatch, workspace.slug, token)

    assert consent["redirect_uri"] == ["http://testserver/api/summon/google-drive/callback/"]
    assert google_drive.DRIVE_SCOPE in consent["scope"][0].split()
    assert consent["access_type"] == ["offline"]
    assert connected_google["Location"] == f"{knowledge}?drive=connected"
    credential = Credential.objects.get(workspace=workspace, owner=user, provider=google_drive.GOOGLE_DRIVE_PROVIDER)
    assert credential.account_identifier == GOOGLE_EMAIL
    assert decrypt_secret(credential.secret_ciphertext) == token["refresh_token"]

    # A state is good only for the person it was issued to.
    stranger = User.objects.create(email=f"other-{uuid4().hex}@plane.test", username=f"other_{uuid4().hex}")
    WorkspaceMember.objects.create(workspace=workspace, member=stranger, role=20)
    other = APIClient()
    other.force_login(stranger)
    assert (
        other.get("/api/summon/google-drive/callback/", {"state": consent["state"][0], "code": "code"}).status_code
        == 400
    )
    assert api.get("/api/summon/google-drive/callback/", {"state": "forged", "code": "code"}).status_code == 400

    body = {"credential": str(credential.id), "project": str(project.id)}
    not_found = api.post(
        f"{base}/drive-folders/",
        {**body, "folder": "https://drive.google.com/drive/folders/elsewhere00"},
        format="json",
    )
    assert not_found.status_code == status.HTTP_400_BAD_REQUEST
    assert not_found.data["error_code"] == "drive_not_found"

    connected = api.post(
        f"{base}/drive-folders/",
        {**body, "folder": f"https://drive.google.com/drive/u/0/folders/{ROOT}?usp=sharing"},
        format="json",
    )

    assert connected.status_code == status.HTTP_201_CREATED, connected.data
    # Docs, Sheets and Slides, subfolders included; the PDF has no text export and is left in Drive.
    assert connected.data["kind"] == "folder"
    assert connected.data["file_count"] == 3
    assert connected.data["live"] is True
    assert connected.data["health"] == "ok"
    assert connected.data["account"] == GOOGLE_EMAIL
    assert FakeDrive.watched[-1] == "https://summon.example/api/summon/google-drive/notifications/"
    pages = {page.name: page for page in Page.objects.filter(summon_drive_files__folder_id=connected.data["id"])}
    assert set(pages) == {"Plan", "Budget", "Kickoff"}
    assert all(page.is_locked and page.access == Page.PUBLIC_ACCESS for page in pages.values())
    assert ProjectPage.objects.filter(project=project, page__in=pages.values()).count() == 3
    # Google's styling and redirect links are dropped; the content and real targets stay.
    assert sent[0] == (
        '<h1>Plan</h1><p><strong>Ship</strong> <a href="https://example.com/spec">spec</a></p>'
        "<ul><li><p>One</p><ol><li><p>Two</p></li></ol></li><li><p><em>Three &lt;b&gt;</em></p></li></ul>"
        "<table><tbody><tr><td><p>Cell</p></td><td><p></p></td></tr></tbody></table>"
    )
    assert "<h2>Budget</h2>" in sent[1] and "<td><p>Printer</p></td><td><p>1200</p></td>" in sent[1]
    assert sent[2] == "<p>Kickoff</p><p>Goals</p>"

    # Drive reports an edit to the doc, the sheet moved to the bin, and a file elsewhere in Drive.
    FakeDrive.feed = [
        {
            "fileId": "doc",
            "file": _file(
                "doc", "Plan v2", "application/vnd.google-apps.document", modified="2026-10-02T00:00:00.000Z"
            ),
        },
        {
            "fileId": "sheet",
            "file": {**_file("sheet", "Budget", "application/vnd.google-apps.spreadsheet"), "trashed": True},
        },
        {"fileId": "other", "file": _file("other", "Elsewhere", "application/vnd.google-apps.document", parent="nope")},
    ]
    folder = DriveFolder.objects.get(id=connected.data["id"])
    queued = []
    monkeypatch.setattr(tasks.sync_drive_changes, "delay", queued.append)
    notify = "/api/summon/google-drive/notifications/"
    headers = {"HTTP_X_GOOG_CHANNEL_ID": folder.channel_id, "HTTP_X_GOOG_RESOURCE_STATE": "change"}
    assert APIClient().post(notify, **headers, HTTP_X_GOOG_CHANNEL_TOKEN="forged").status_code == 204
    assert queued == []
    APIClient().post(notify, **headers, HTTP_X_GOOG_CHANNEL_TOKEN=folder.channel_token)
    assert queued == [str(folder.id)]

    tasks.sync_drive_changes(queued.pop())

    pages["Plan"].refresh_from_db()
    pages["Budget"].refresh_from_db()
    assert pages["Plan"].name == "Plan v2"
    assert pages["Budget"].archived_at is not None
    assert set(DriveFile.objects.filter(folder=folder).values_list("file_id", flat=True)) == {"doc", "slides"}
    folder.refresh_from_db()
    assert folder.page_token == "token-2"

    # The person withdraws Summon's access in their Google account: the next sync marks the folder and the account.
    FakeDrive.revoked = True
    tasks.sync_drive_changes(str(folder.id))

    [listed] = api.get(f"{base}/drive-folders/").data
    assert listed["health"] == "revoked"
    credential.refresh_from_db()
    assert credential.status == Credential.Status.REVOKED

    # Reconnecting the same Google account restores it and queues the folder to catch up.
    FakeDrive.revoked = False
    monkeypatch.setattr(drive_views.sync_drive_changes, "delay", queued.append)
    _connect_google(api, monkeypatch, workspace.slug, _google_token())
    credential.refresh_from_db()
    assert credential.status == Credential.Status.ACTIVE
    assert queued == [str(folder.id)]
    [listed] = api.get(f"{base}/drive-folders/").data
    assert listed["health"] == "ok"

    disconnected = api.delete(f"{base}/drive-folders/{folder.id}/")

    assert disconnected.status_code == status.HTTP_204_NO_CONTENT
    assert FakeDrive.stopped == [folder.channel_id]
    pages["Plan"].refresh_from_db()
    # The pages stay, as ordinary editable pages.
    assert pages["Plan"].is_locked is False
    assert not DriveFolder.objects.filter(id=folder.id).exists()


@pytest.mark.django_db
def test_single_doc_link_syncs_one_locked_page_that_follows_the_file(workspace, drive, monkeypatch):
    api, user, project, sent = drive
    base = f"/api/summon/workspaces/{workspace.slug}"
    token = _google_token()
    monkeypatch.setattr(google_drive, "_token_request", lambda data: token)
    credential = google_drive.save_google_account(workspace, user, GOOGLE_EMAIL, token["refresh_token"])
    body = {"credential": str(credential.id), "project": str(project.id)}

    # A PDF has no text export, so there is nothing to keep a page in step with.
    unsupported = api.post(
        f"{base}/drive-folders/", {**body, "folder": f"https://drive.google.com/file/d/{LOOSE_PDF}/view"}, format="json"
    )
    assert unsupported.status_code == status.HTTP_400_BAD_REQUEST
    assert unsupported.data["error_code"] == "drive_file_unsupported"

    connected = api.post(
        f"{base}/drive-folders/",
        {**body, "folder": f"https://docs.google.com/document/d/{SOLO}/edit?tab=t.0"},
        format="json",
    )

    assert connected.status_code == status.HTTP_201_CREATED, connected.data
    assert connected.data["kind"] == "file"
    assert connected.data["name"] == "Brief"
    assert connected.data["file_count"] == 1
    assert connected.data["folder_url"] == f"https://drive.google.com/file/d/{SOLO}/view"
    page = Page.objects.get(summon_drive_files__folder_id=connected.data["id"])
    assert page.name == "Brief" and page.is_locked
    # Every tab of the Doc lands on the page, each under its title.
    assert sent == ["<h1>Scope</h1><p>Scope</p><h1>Notes</h1><p>Later</p>"]

    # Edits elsewhere in Drive do not touch it; a rename of the file renames the page and the source.
    FakeDrive.feed = [
        {"fileId": "doc", "file": _file("doc", "Plan v2", "application/vnd.google-apps.document")},
        {
            "fileId": SOLO,
            "file": _file(
                SOLO,
                "Brief v2",
                "application/vnd.google-apps.document",
                parent="elsewhere",
                modified="2026-10-02T00:00:00.000Z",
            ),
        },
    ]
    tasks.sync_drive_changes(connected.data["id"])

    page.refresh_from_db()
    assert page.name == "Brief v2"
    [listed] = api.get(f"{base}/drive-folders/").data
    assert listed["name"] == "Brief v2"
    assert listed["health"] == "ok"

    # Moving the file to the bin archives its page.
    FakeDrive.feed = [{"fileId": SOLO, "file": {**FakeDrive.loose[SOLO], "trashed": True}}]
    tasks.sync_drive_changes(connected.data["id"])

    page.refresh_from_db()
    assert page.archived_at is not None
    assert not DriveFile.objects.filter(folder_id=connected.data["id"]).exists()
