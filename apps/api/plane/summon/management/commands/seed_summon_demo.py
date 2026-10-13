# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape

from plane.db.models import (
    DEFAULT_STATES,
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueLabel,
    Label,
    Module,
    ModuleIssue,
    Project,
    ProjectIdentifier,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.summon.models import (
    Client,
    ClientContact,
    Meeting,
    MeetingParticipant,
    MeetingWorkItem,
    Opportunity,
    ResourceLink,
    SummonProjectProfile,
)
from plane.summon.services.automation_templates import ensure_default_templates

SOURCE = "summon_demo"
STATE_NAMES = {
    "backlog": "Backlog",
    "todo": "Todo",
    "in_progress": "In Progress",
    "done": "Done",
    "cancelled": "Cancelled",
}
JAKARTA = ZoneInfo("Asia/Jakarta")  # fixture meeting times are WIB, as the team books them
LABEL_COLORS = ("#3c68e8", "#0f9d74", "#d97706", "#db2777", "#7c3aed", "#0891b2")


class Command(BaseCommand):
    help = (
        "Local development only: replace a workspace's demo data with the realistic Summon fixture "
        "(team, clients, pipeline, projects, tasks, meetings). Dates like '+5d' are relative to today. "
        "Pages are left out: they need Plane Live, which local Docker does not run."
    )

    def add_arguments(self, parser):
        parser.add_argument("--workspace", required=True)
        parser.add_argument("--owner-email", required=True)
        parser.add_argument("--fixture", required=True, help="Path to the JSON fixture (kept out of git).")

    def handle(self, *args, **options):
        fixture = json.loads(Path(options["fixture"]).read_text())
        workspace = Workspace.objects.filter(slug=options["workspace"]).first()
        if not workspace:
            raise CommandError(f"Workspace {options['workspace']!r} was not found.")
        owner = User.objects.filter(email__iexact=options["owner_email"], is_active=True).first()
        if not owner or not WorkspaceMember.objects.filter(workspace=workspace, member=owner, is_active=True).exists():
            raise CommandError(f"{options['owner_email']!r} is not an active member of {workspace.slug!r}.")

        with transaction.atomic():
            self._reset(workspace, fixture)
            Seed(workspace, owner, fixture).run()
        self.stdout.write(self.style.SUCCESS(f"Reseeded {workspace.slug}: " + ", ".join(self._totals(workspace))))

    def _reset(self, workspace, fixture):
        """Hard-delete what an earlier run created, so a rerun gives a clean copy with current dates.
        Project and client links go with their project or client; the rest are matched on the fixture."""
        scoped = {"workspace": workspace, "external_source": SOURCE}
        Meeting.all_objects.filter(**scoped).delete()
        Project.all_objects.filter(**scoped).delete()
        titles = [item["title"] for item in fixture.get("opportunities", [])]
        Opportunity.all_objects.filter(workspace=workspace, title__in=titles).delete()
        Client.all_objects.filter(**scoped).delete()
        urls = [item["url"] for item in fixture.get("resources", [])]
        ResourceLink.all_objects.filter(workspace=workspace, project__isnull=True, url__in=urls).delete()

    def _totals(self, workspace):
        counts = {
            "clients": Client.objects.filter(workspace=workspace),
            "opportunities": Opportunity.objects.filter(workspace=workspace),
            "projects": Project.objects.filter(workspace=workspace),
            "tasks": Issue.objects.filter(workspace=workspace),
            "meetings": Meeting.objects.filter(workspace=workspace),
            "members": WorkspaceMember.objects.filter(workspace=workspace, is_active=True),
        }
        return [f"{name}={queryset.count()}" for name, queryset in counts.items()]


def when(value):
    """An ISO date, or an offset from today such as '+5d' or '-2w'."""
    if not value:
        return None
    if value[0] in "+-":
        unit = {"d": 1, "w": 7}[value[-1]]
        return date.today() + timedelta(days=int(value[:-1]) * unit)
    return date.fromisoformat(value)


def at(value, clock):
    hour, minute = (int(part) for part in clock.split(":"))
    return datetime.combine(when(value), datetime.min.time()).replace(hour=hour, minute=minute, tzinfo=JAKARTA)


class Seed:
    def __init__(self, workspace, owner, fixture):
        self.workspace = workspace
        self.owner = owner
        self.fixture = fixture
        self.people = {owner.email: owner}
        self.clients = {}
        self.opportunities = {}
        self.projects = {}
        self.tasks = {}

    def run(self):
        for person in self.fixture.get("team", []):
            self._person(person)
        for item in self.fixture.get("clients", []):
            self._client(item)
        for item in self.fixture.get("opportunities", []):
            self._opportunity(item)
        for item in self.fixture.get("projects", []):
            self._project(item)
        for item in self.fixture.get("meetings", []):
            self._meeting(item)
        for item in self.fixture.get("resources", []):
            self._resource(item)
        ensure_default_templates(self.workspace)

    def _person(self, person):
        user = User.objects.filter(email__iexact=person["email"]).first()
        if not user:
            user = User.objects.create(
                email=person["email"],
                username=person["email"].split("@")[0],
                first_name=person["first_name"],
                last_name=person.get("last_name", ""),
                display_name=person["first_name"].lower(),
                is_password_autoset=True,
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])
        WorkspaceMember.objects.update_or_create(
            workspace=self.workspace, member=user, defaults={"role": person.get("role", 15), "is_active": True}
        )
        self.people[user.email] = user

    def _user(self, email):
        return self.people.get(email, self.owner) if email else None

    def _client(self, item):
        client = Client.objects.create(
            workspace=self.workspace,
            owner=self._user(item.get("owner")) or self.owner,
            name=item["name"],
            company_name=item.get("company_name", item["name"]),
            industry=item.get("industry", ""),
            website=item.get("website", ""),
            head_office=item.get("head_office", ""),
            relationship_started_at=when(item.get("since")),
            notes=item.get("notes", ""),
            status=item.get("status", Client.Status.ACTIVE),
            external_source=SOURCE,
            external_id=f"client:{item['name']}",
            created_by=self.owner,
        )
        for index, contact in enumerate(item.get("contacts", [])):
            ClientContact.objects.create(
                workspace=self.workspace,
                client=client,
                name=contact["name"],
                title=contact.get("title", ""),
                is_primary=index == 0,
                created_by=self.owner,
            )
        self.clients[item["name"]] = client

    def _opportunity(self, item):
        self.opportunities[item["title"]] = Opportunity.objects.create(
            workspace=self.workspace,
            client=self.clients.get(item.get("client")),
            owner=self._user(item.get("owner")) or self.owner,
            title=item["title"],
            product=item.get("product", ""),
            source=item.get("source", ""),
            description=item.get("description", ""),
            stage=item["stage"],
            value=item.get("value"),
            probability=item.get("probability", 0),
            expected_close_date=when(item.get("close")),
            created_by=self.owner,
        )

    def _project(self, item):
        lead = self._user(item.get("lead")) or self.owner
        project = Project.objects.create(
            workspace=self.workspace,
            name=item["name"],
            identifier=item["identifier"],
            description=item.get("summary", ""),
            network=2,
            page_view=True,
            module_view=True,
            project_lead=lead,
            external_source=SOURCE,
            external_id=f"project:{item['identifier']}",
            created_by=self.owner,
        )
        ProjectIdentifier.objects.create(
            workspace=self.workspace, project=project, name=item["identifier"], created_by=self.owner
        )
        for membership in WorkspaceMember.objects.filter(workspace=self.workspace, is_active=True):
            ProjectMember.objects.create(
                project=project, member_id=membership.member_id, role=membership.role, created_by=self.owner
            )
        states = State.objects.bulk_create(
            [
                State(project=project, workspace=self.workspace, created_by=self.owner, **state)
                for state in DEFAULT_STATES
                if state["group"] != "triage"
            ]
        )
        project.default_state = next(state for state in states if state.default)
        project.save(update_fields=["default_state", "updated_at"])
        client = self.clients.get(item.get("client"))
        SummonProjectProfile.objects.create(
            workspace=self.workspace,
            project=project,
            client=client,
            source_opportunity=self.opportunities.get(item.get("opportunity")),
            delivery_status=item.get("delivery_status", SummonProjectProfile.DeliveryStatus.ACTIVE),
            phase=item.get("phase", ""),
            health=item.get("health", SummonProjectProfile.ProjectHealth.ON_TRACK),
            start_date=when(item.get("start")),
            target_date=when(item.get("target")),
            budget=item.get("budget"),
            created_by=self.owner,
        )
        for link in item.get("links", []):
            ResourceLink.objects.create(
                workspace=self.workspace,
                project=project,
                title=link["title"],
                url=link["url"],
                category=link.get("category", "reference"),
                created_by=self.owner,
            )

        state_by_name = {state.name: state for state in states}
        modules = {}
        for milestone in item.get("milestones", []):
            modules[milestone["name"]] = Module.objects.create(
                workspace=self.workspace,
                project=project,
                name=milestone["name"],
                description=milestone.get("description", ""),
                start_date=when(milestone.get("start")),
                target_date=when(milestone.get("target")),
                status=milestone.get("status", "planned"),
                lead=lead,
                created_by=self.owner,
            )
        labels = {}
        for index, task in enumerate(item.get("tasks", []), start=1):
            self.tasks[(item["identifier"], task["name"])] = self._task(
                project, state_by_name, modules, labels, task, index
            )

    def _task(self, project, states, modules, labels, task, index):
        state = states[STATE_NAMES[task.get("state", "todo")]]
        issue = Issue.objects.create(
            workspace=self.workspace,
            project=project,
            state=state,
            name=task["name"],
            description_html=f"<p>{escape(task.get('description', task['name']))}</p>",
            priority=task.get("priority", "medium"),
            start_date=when(task.get("start")),
            target_date=when(task.get("due")),
            completed_at=timezone.now() if state.group == "completed" else None,
            external_source=SOURCE,
            external_id=f"task:{project.identifier}:{index}",
            created_by=self.owner,
        )
        assignee = self._user(task.get("assignee"))
        if assignee:
            IssueAssignee.objects.create(
                workspace=self.workspace, project=project, issue=issue, assignee=assignee, created_by=self.owner
            )
        if task.get("milestone") in modules:
            ModuleIssue.objects.create(
                workspace=self.workspace,
                project=project,
                module=modules[task["milestone"]],
                issue=issue,
                created_by=self.owner,
            )
        for name in task.get("labels", []):
            if name not in labels:
                labels[name] = Label.objects.create(
                    workspace=self.workspace,
                    project=project,
                    name=name,
                    color=LABEL_COLORS[len(labels) % len(LABEL_COLORS)],
                    created_by=self.owner,
                )
            IssueLabel.objects.create(
                workspace=self.workspace, project=project, issue=issue, label=labels[name], created_by=self.owner
            )
        IssueActivity.objects.create(
            workspace=self.workspace,
            project=project,
            issue=issue,
            verb="created",
            comment="created the work item",
            actor=assignee or self.owner,
        )
        return issue

    def _meeting(self, item):
        project = Project.objects.filter(
            workspace=self.workspace, external_source=SOURCE, identifier=item.get("project")
        ).first()
        meeting = Meeting.objects.create(
            workspace=self.workspace,
            project=project,
            organizer=self._user(item.get("organizer")) or self.owner,
            title=item["title"],
            agenda=item.get("agenda", ""),
            notes=item.get("notes", ""),
            location=item.get("location", ""),
            meeting_url=item.get("meeting_url", ""),
            status=item.get("status", Meeting.Status.SCHEDULED),
            starts_at=at(item["date"], item.get("start", "10:00")),
            ends_at=at(item["date"], item.get("end", "11:00")),
            external_source=SOURCE,
            external_id=f"meeting:{item['title']}",
            created_by=self.owner,
        )
        for email in item.get("participants", []):
            MeetingParticipant.objects.create(
                workspace=self.workspace,
                meeting=meeting,
                member=self._user(email),
                response=MeetingParticipant.Response.ACCEPTED,
                created_by=self.owner,
            )
        for name in item.get("tasks", []):
            issue = self.tasks.get((item.get("project"), name))
            if issue:
                MeetingWorkItem.objects.create(
                    workspace=self.workspace, meeting=meeting, issue=issue, created_by=self.owner
                )

    def _resource(self, item):
        ResourceLink.objects.create(
            workspace=self.workspace,
            client=self.clients.get(item.get("client")),
            title=item["title"],
            url=item["url"],
            description=item.get("description", ""),
            category=item.get("category", "reference"),
            created_by=self.owner,
        )
