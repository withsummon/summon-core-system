# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Import tl;dv meetings: metadata, the speaker transcript and tl;dv's AI notes.

tl;dv stays the owner of the recording; a meeting keeps `external_source="tldv"` and its tl;dv id, so a re-import
updates the same meeting instead of adding another, and the page can link back to the recording.
"""

import re
from collections import defaultdict
from datetime import datetime, timedelta
from urllib.parse import urlparse

import requests
from django.db import transaction
from django.utils.dateparse import parse_datetime

from plane.db.models import Project, WorkspaceMember
from plane.summon.models import ClientContact, Meeting, MeetingParticipant, SummonProjectProfile
from plane.summon.services.meeting_transcript import write_meeting_transcript

TLDV_SOURCE = "tldv"
TLDV_API_URL = "https://pasta.tldv.io/v1alpha1"
TLDV_TIMEOUT_SECONDS = 20
# One request imports at most this many new meetings, so a first sync of a long history stays well inside a request.
TLDV_IMPORT_BATCH = 15
# Mailbox providers anyone can sign up to: a shared domain says nothing about which client a person works for.
PUBLIC_EMAIL_DOMAINS = frozenset(
    {"gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "proton.me"}
)


class TldvError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def parse_happened_at(value):
    """tl;dv's REST API sends JavaScript `Date.toString()` text ("Wed Oct 14 2026 08:01:15 GMT+0000 (Coordinated
    Universal Time)"); its webhooks and MCP send ISO 8601. Returns None for anything else."""
    if not isinstance(value, str):
        return None
    parsed = parse_datetime(value)
    if parsed:
        return parsed
    try:
        return datetime.strptime(value.split(" (", 1)[0], "%a %b %d %Y %H:%M:%S GMT%z")
    except ValueError:
        return None


def tldv_meeting_url(external_id):
    return f"https://tldv.io/app/meetings/{external_id}"


class TldvClient:
    def __init__(self, api_key):
        self.session = requests.Session()
        self.session.headers.update({"x-api-key": api_key, "Accept": "application/json"})

    def _get(self, path, params=None, allow_missing=False):
        try:
            response = self.session.get(f"{TLDV_API_URL}{path}", params=params, timeout=TLDV_TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            raise TldvError("tldv_unreachable") from exc
        if response.status_code in (401, 403):
            raise TldvError("tldv_unauthorized")
        # A meeting with nothing transcribed answers 204, and one still processing 404; it imports without them.
        if allow_missing and response.status_code in (204, 404):
            return None
        if response.status_code >= 400:
            raise TldvError(f"tldv_http_{response.status_code}")
        try:
            return response.json()
        except ValueError as exc:
            raise TldvError("tldv_invalid_response") from exc

    def meetings(self, page=1, happened_after=None):
        params = {"page": page, "limit": 50, "onlyParticipated": "false"}
        if happened_after:
            params["from"] = happened_after.isoformat().replace("+00:00", "Z")
        return self._get("/meetings", params)

    def transcript(self, meeting_id):
        return self._get(f"/meetings/{meeting_id}/transcript", allow_missing=True)

    def notes(self, meeting_id):
        return self._get(f"/meetings/{meeting_id}/notes", allow_missing=True)


def _clock(seconds):
    seconds = int(seconds)
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}" if hours else f"{minutes:02d}:{secs:02d}"


def transcript_segments(transcript):
    """tl;dv transcript `data` → the segment shape `write_meeting_transcript` stores (times in seconds)."""
    segments = []
    for item in (transcript or {}).get("data") or []:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        start = item.get("startTime")
        end = item.get("endTime")
        segments.append(
            {
                "start": float(start) if isinstance(start, (int, float)) else None,
                "end": float(end) if isinstance(end, (int, float)) else None,
                "speaker": (item.get("speaker") or "").strip(),
                "text": text,
            }
        )
    return segments


def segments_text(segments):
    """The plain transcript the summary model reads: one `[mm:ss] Speaker: text` line per segment."""
    lines = []
    for segment in segments:
        stamp = f"[{_clock(segment['start'])}] " if segment["start"] is not None else ""
        speaker = f"{segment['speaker']}: " if segment["speaker"] else ""
        lines.append(f"{stamp}{speaker}{segment['text']}")
    return "\n".join(lines)


def meeting_attendees(meeting):
    """Organizer first, then invitees, one entry per email: the `{name, email}` list a Meeting keeps."""
    attendees, seen = [], set()
    for person in [meeting.get("organizer") or {}, *(meeting.get("invitees") or [])]:
        email = (person.get("email") or "").strip().lower()
        if email and email not in seen:
            seen.add(email)
            attendees.append({"name": (person.get("name") or "").strip(), "email": email})
    return attendees


def _attendee_member_ids(workspace, attendees):
    emails = [attendee["email"] for attendee in attendees]
    if not emails:
        return []
    return list(
        WorkspaceMember.objects.filter(workspace=workspace, is_active=True, member__email__in=emails).values_list(
            "member_id", flat=True
        )
    )


# Indonesian company forms around the name people actually say: "PT PLN (Persero)" is "PLN" in a meeting title.
_LEGAL_FORM = re.compile(r"\([^)]*\)|^(?:PT|CV)\.?\s+|\s+Tbk\.?$", re.IGNORECASE)


def _client_title_terms(name):
    """(term, exact_case) pairs that name a client in a meeting title: the name without its legal form, its
    acronym ("Surya Artha Nusantara Finance" → "SANF") and a leading code ("MNC Group" → "MNC"), the last two only
    in capitals."""
    short = " ".join(_LEGAL_FORM.sub(" ", name).split())
    words = [word for word in short.split() if word.isalpha()]
    terms = {(name, False), (short, False)}
    if len(words) >= 3:
        terms.add(("".join(word[0] for word in words).upper(), True))
    if words and len(words[0]) >= 2 and words[0].isupper():
        terms.add((words[0], True))
    return {(term, exact_case) for term, exact_case in terms if term}


def _domain(value):
    value = (value or "").strip().lower()
    if "@" in value:
        return value.rsplit("@", 1)[1]
    host = urlparse(value if "//" in value else f"//{value}").hostname or ""
    return host.removeprefix("www.")


class ProjectMatcher:
    """Files an imported meeting under the client project it is about, among the projects the importer may write.

    Attendees decide first: a client contact's email, else a client's own email domain or website. A client name or
    project identifier in the meeting title decides next, or narrows several attendee matches. Anything still
    ambiguous returns None so the caller's chosen project applies.
    """

    def __init__(self, workspace, project_ids):
        self.projects = {
            project.id: project for project in Project.objects.filter(workspace=workspace, id__in=project_ids)
        }
        self.by_email = defaultdict(set)
        self.by_domain = defaultdict(set)
        self.by_title = defaultdict(set)
        for project in self.projects.values():
            # Identifiers are short codes ("BSB"), so they must appear in capitals to count.
            self.by_title[(project.identifier, True)].add(project.id)
        profiles = SummonProjectProfile.objects.filter(
            workspace=workspace, project_id__in=self.projects, client__isnull=False
        ).select_related("client")
        client_projects = defaultdict(set)
        for profile in profiles:
            client_projects[profile.client_id].add(profile.project_id)
            client = profile.client
            for name in {client.name, client.company_name} - {""}:
                for term in _client_title_terms(name):
                    self.by_title[term].add(profile.project_id)
            for domain in {_domain(client.email), _domain(client.website)} - {""} - PUBLIC_EMAIL_DOMAINS:
                self.by_domain[domain].add(profile.project_id)
        contacts = ClientContact.objects.filter(workspace=workspace, client_id__in=client_projects).exclude(email="")
        for client_id, email in contacts.values_list("client_id", "email"):
            email = email.lower()
            self.by_email[email] |= client_projects[client_id]
            if _domain(email) not in PUBLIC_EMAIL_DOMAINS:
                self.by_domain[_domain(email)] |= client_projects[client_id]

    def _title_matches(self, title):
        found = set()
        for (term, exact_case), project_ids in self.by_title.items():
            pattern = rf"(?<!\w){re.escape(term)}(?!\w)"
            if re.search(pattern, title, 0 if exact_case else re.IGNORECASE):
                found |= project_ids
        return found

    def match(self, title, attendees):
        emails = {attendee["email"] for attendee in attendees}
        by_people = set().union(*(self.by_email[email] for email in emails if email in self.by_email))
        if not by_people:
            domains = {_domain(email) for email in emails}
            by_people = set().union(*(self.by_domain[domain] for domain in domains if domain in self.by_domain))
        by_title = self._title_matches(title or "")
        candidates = (by_people & by_title or by_people) if by_people else by_title
        return self.projects[candidates.pop()] if len(candidates) == 1 else None


@transaction.atomic
def import_tldv_meeting(workspace, project, actor, meeting, transcript=None, notes=None, matcher=None):
    """Create or update the Summon meeting for one tl;dv meeting payload. Returns (meeting, created)."""
    starts_at = parse_happened_at(meeting.get("happenedAt"))
    if not starts_at:
        raise TldvError("tldv_invalid_meeting")
    duration = meeting.get("duration")
    attendees = meeting_attendees(meeting)
    fields = {
        "project": (matcher and matcher.match(meeting.get("name"), attendees)) or project,
        "title": (meeting.get("name") or "tl;dv meeting")[:255],
        "status": Meeting.Status.COMPLETED,
        "starts_at": starts_at,
        "ends_at": starts_at + timedelta(seconds=duration) if isinstance(duration, (int, float)) else None,
        "notes": (notes or {}).get("markdownContent") or "",
        "attendees": attendees,
    }
    # create_defaults replaces defaults on insert, so it carries every field plus the importing organizer.
    instance, created = Meeting.objects.update_or_create(
        workspace=workspace,
        external_source=TLDV_SOURCE,
        external_id=meeting["id"],
        defaults=fields,
        create_defaults={**fields, "organizer": actor},
    )
    member_ids = _attendee_member_ids(workspace, attendees)
    existing = set(instance.participants.values_list("member_id", flat=True))
    MeetingParticipant.objects.bulk_create(
        [
            MeetingParticipant(
                workspace=workspace,
                meeting=instance,
                member_id=member_id,
                response=MeetingParticipant.Response.ACCEPTED,
                created_by=actor,
            )
            for member_id in member_ids
            if member_id not in existing
        ]
    )
    segments = transcript_segments(transcript)
    if segments:
        write_meeting_transcript(instance, actor, segments_text(segments), segments=segments)
    return instance, created


def sync_tldv_meetings(workspace, project, actor, api_key, project_ids):
    """Import tl;dv meetings this workspace has not seen yet, newest first, at most `TLDV_IMPORT_BATCH` per call.
    Each lands in the client project `ProjectMatcher` finds among `project_ids`, else in `project`."""
    client = TldvClient(api_key)
    matcher = ProjectMatcher(workspace, project_ids)
    known = set(
        Meeting.objects.filter(workspace=workspace, external_source=TLDV_SOURCE).values_list("external_id", flat=True)
    )
    pending = []
    page, pages = 1, 1
    while page <= pages:
        listing = client.meetings(page=page)
        pages = listing.get("pages") or 1
        pending.extend(
            item
            for item in listing.get("results") or []
            if item["id"] not in known and parse_happened_at(item.get("happenedAt"))
        )
        page += 1
    pending.sort(key=lambda item: parse_happened_at(item["happenedAt"]), reverse=True)
    imported = []
    for item in pending[:TLDV_IMPORT_BATCH]:
        meeting, _created = import_tldv_meeting(
            workspace,
            project,
            actor,
            item,
            transcript=client.transcript(item["id"]),
            notes=client.notes(item["id"]),
            matcher=matcher,
        )
        imported.append(meeting)
    return imported, max(len(pending) - TLDV_IMPORT_BATCH, 0)
