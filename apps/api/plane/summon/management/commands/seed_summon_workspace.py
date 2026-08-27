# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.html import escape

from plane.db.models import (
    DEFAULT_STATES,
    Issue,
    Page,
    Project,
    ProjectIdentifier,
    ProjectMember,
    ProjectPage,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.summon.models import (
    AutomationTemplate,
    Client,
    Meeting,
    MeetingWorkItem,
    Opportunity,
    ResourceLink,
    SummonPageContext,
    SummonProjectProfile,
)
from plane.summon.seed_helpers import placeholder_inventory, preview_counts, seed_totals
from plane.summon.seed_manifest import MEETING, PROJECTS, WORK_ITEMS, client_id, page_html, repository_id
from plane.summon.services.automation_templates import (
    DEFAULT_TEMPLATES,
    SYSTEM_TEMPLATE_SOURCE,
    ensure_default_templates,
    is_adoptable_default_template,
)
from plane.summon.services.page_document import write_page_document

SOURCE = "summon_seed"


class Command(BaseCommand):
    help = "Preview or idempotently seed the curated Summon production workspace."

    def add_arguments(self, parser):
        parser.add_argument("--workspace", required=True)
        parser.add_argument("--owner-email", required=True)
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--archive-placeholders", action="store_true")
        parser.add_argument("--placeholder-digest")

    def handle(self, *args, **options):
        workspace, owner = self._scope(options["workspace"], options["owner_email"])

        if not options["apply"]:
            self._validate_collisions(workspace)
            counts = preview_counts(workspace)
            inventory, digest = placeholder_inventory(workspace)
            suffix = self._placeholder_summary(inventory, digest) if options["archive_placeholders"] else ""
            self.stdout.write(f"PREVIEW {self._count_summary('created', counts)}{suffix}")
            return

        try:
            with transaction.atomic():
                self._validate_collisions(workspace)
                created = preview_counts(workspace)
                inventory, digest = placeholder_inventory(workspace, lock=options["archive_placeholders"])
                if options["archive_placeholders"] and options["placeholder_digest"] != digest:
                    raise CommandError(
                        "Placeholder digest does not match the latest preview; preview again before applying."
                    )
                self._seed(workspace, owner)
                if options["archive_placeholders"]:
                    self._archive_placeholders(inventory)
                totals = seed_totals(workspace)
        except CommandError:
            raise
        except Exception as error:
            raise CommandError(str(error)) from error

        suffix = self._placeholder_summary(inventory, digest) if options["archive_placeholders"] else ""
        self.stdout.write(
            f"APPLIED {self._count_summary('created', created)} {self._count_summary('total', totals)}{suffix}"
        )

    def _scope(self, slug, email):
        workspace = Workspace.objects.filter(slug=slug).first()
        if not workspace:
            raise CommandError(f"Workspace {slug!r} was not found.")
        owner = User.objects.filter(email__iexact=email, is_active=True).first()
        if not owner:
            raise CommandError(f"Active user {email!r} was not found.")
        if not WorkspaceMember.objects.filter(workspace=workspace, member=owner, is_active=True).exists():
            raise CommandError(f"{email!r} is not an active member of workspace {slug!r}.")
        return workspace, owner

    def _validate_collisions(self, workspace):
        for item in PROJECTS:
            source_id = repository_id(item)
            seeded = Project.objects.filter(workspace=workspace, external_source=SOURCE, external_id=source_id).first()
            collision = Project.objects.filter(workspace=workspace).filter(
                Q(name=item["name"]) | Q(identifier=item["identifier"]) | Q(external_id=source_id)
            )
            if self._has_collision(collision, seeded):
                raise CommandError(f"Project collision for {item['name']}.")
            page_id = f"project-brief:{source_id}"
            seeded_page = Page.objects.filter(workspace=workspace, external_source=SOURCE, external_id=page_id).first()
            page_collision = Page.objects.filter(workspace=workspace).filter(
                Q(name=f"Project Brief - {item['name']}") | Q(external_id=page_id)
            )
            if self._has_collision(page_collision, seeded_page):
                raise CommandError(f"Page collision for {item['name']}.")
        for name in {item["client"] for item in PROJECTS}:
            external_id = client_id(name)
            seeded = Client.objects.filter(workspace=workspace, external_source=SOURCE, external_id=external_id).first()
            collision = Client.objects.filter(workspace=workspace).filter(Q(name=name) | Q(external_id=external_id))
            if self._has_collision(collision, seeded):
                raise CommandError(f"Client collision for {name}.")
        seeded_meeting = Meeting.objects.filter(
            workspace=workspace, external_source=SOURCE, external_id=MEETING["external_id"]
        ).first()
        meeting_collision = Meeting.objects.filter(workspace=workspace).filter(
            Q(title=MEETING["title"]) | Q(external_id=MEETING["external_id"])
        )
        if self._has_collision(meeting_collision, seeded_meeting):
            raise CommandError(f"Meeting collision for {MEETING['title']}.")
        for index, _ in enumerate(WORK_ITEMS, start=1):
            external_id = f"{MEETING['external_id']}:{index}"
            seeded = Issue.objects.filter(workspace=workspace, external_source=SOURCE, external_id=external_id).first()
            collision = Issue.objects.filter(workspace=workspace, external_id=external_id)
            if self._has_collision(collision, seeded):
                raise CommandError(f"Issue collision for {external_id}.")
        for template_type, (name, variables, content) in DEFAULT_TEMPLATES.items():
            external_id = f"template:{template_type}"
            seeded = AutomationTemplate.objects.filter(
                workspace=workspace,
                external_source=SYSTEM_TEMPLATE_SOURCE,
                external_id=external_id,
            ).first()
            collision = AutomationTemplate.objects.filter(workspace=workspace).filter(
                Q(name=name) | Q(external_id=external_id)
            )
            if seeded:
                collision = collision.exclude(id=seeded.id)
            if any(
                not is_adoptable_default_template(template, template_type, name, variables, content)
                for template in collision
            ):
                raise CommandError(f"Automation template collision for {name}.")

    def _has_collision(self, queryset, seeded):
        if seeded:
            queryset = queryset.exclude(id=seeded.id)
        return queryset.exists()

    def _seed(self, workspace, owner):
        clients = {}
        for name in {item["client"] for item in PROJECTS}:
            external_id = client_id(name)
            client = Client.objects.filter(workspace=workspace, external_source=SOURCE, external_id=external_id).first()
            if not client:
                client = Client.objects.create(
                    workspace=workspace,
                    name=name,
                    company_name=name,
                    owner=owner,
                    status=Client.Status.ACTIVE,
                    external_source=SOURCE,
                    external_id=external_id,
                )
            clients[name] = client
        members = list(WorkspaceMember.objects.filter(workspace=workspace, is_active=True).select_related("member"))
        created = 0
        for item in PROJECTS:
            project = Project.objects.filter(
                workspace=workspace, external_source=SOURCE, external_id=repository_id(item)
            ).first()
            if project:
                continue
            project = self._create_project(workspace, owner, members, clients[item["client"]], item)
            self._create_brief(workspace, owner, project, clients[item["client"]], item)
            created += 1
        ensure_default_templates(workspace)
        self._create_meeting(workspace, owner)
        return created

    def _create_project(self, workspace, owner, members, client, item):
        project = Project.objects.create(
            workspace=workspace,
            name=item["name"],
            identifier=item["identifier"],
            description=item["summary"],
            network=2,
            page_view=True,
            external_source=SOURCE,
            external_id=repository_id(item),
            created_by=owner,
        )
        ProjectIdentifier.objects.create(
            workspace=workspace, project=project, name=item["identifier"], created_by=owner
        )
        for membership in members:
            ProjectMember.objects.create(
                project=project,
                member=membership.member,
                role=membership.role if membership.role in (5, 15, 20) else 15,
                created_by=owner,
            )
        states = State.objects.bulk_create(
            [
                State(project=project, workspace=workspace, created_by=owner, **state)
                for state in DEFAULT_STATES
                if state["group"] != "triage"
            ]
        )
        project.default_state = next(state for state in states if state.default)
        project.save(update_fields=["default_state", "updated_at"])
        SummonProjectProfile.objects.create(
            workspace=workspace,
            project=project,
            client=client,
            delivery_status=(
                SummonProjectProfile.DeliveryStatus.ACTIVE
                if item.get("live_url")
                else SummonProjectProfile.DeliveryStatus.NOT_ASSESSED
            ),
            health=SummonProjectProfile.ProjectHealth.NOT_ASSESSED,
            created_by=owner,
        )
        return project

    def _create_brief(self, workspace, owner, project, client, item):
        source_id = repository_id(item)
        page = Page(
            workspace=workspace,
            owned_by=owner,
            name=f"Project Brief - {item['name']}",
            access=Page.PUBLIC_ACCESS,
            external_source=SOURCE,
            external_id=f"project-brief:{source_id}",
            created_by=owner,
        )
        write_page_document(page, page_html(item), {"type": "project_brief", "source": source_id})
        ProjectPage.objects.create(workspace=workspace, project=project, page=page, created_by=owner)
        SummonPageContext.objects.create(
            workspace=workspace,
            page=page,
            project=project,
            client=client,
            category="project_brief",
            tags=["summon_seed"],
            created_by=owner,
        )
        repository_url = f"https://github.com/withsummon/{item['repository']}"
        ResourceLink.objects.create(
            workspace=workspace,
            project=project,
            title=f"GitHub - {item['repository']}",
            url=repository_url,
            category="repository",
            created_by=owner,
        )
        if item.get("live_url"):
            ResourceLink.objects.create(
                workspace=workspace,
                project=project,
                title=f"Production - {item['name']}",
                url=item["live_url"],
                category="deployment",
                created_by=owner,
            )

    def _create_meeting(self, workspace, owner):
        project = Project.objects.get(
            workspace=workspace,
            external_source=SOURCE,
            external_id=f"github:withsummon/{MEETING['project_repository']}",
        )
        meeting = Meeting.objects.filter(
            workspace=workspace, external_source=SOURCE, external_id=MEETING["external_id"]
        ).first()
        if not meeting:
            meeting = Meeting.objects.create(
                workspace=workspace,
                project=project,
                organizer=owner,
                title=MEETING["title"],
                agenda=MEETING["agenda"],
                notes=MEETING["notes"],
                location=MEETING["location"],
                status=Meeting.Status.COMPLETED,
                starts_at=datetime.fromisoformat(MEETING["starts_at"]),
                ends_at=datetime.fromisoformat(MEETING["ends_at"]),
                external_source=SOURCE,
                external_id=MEETING["external_id"],
                created_by=owner,
            )
        todo = State.objects.get(project=project, name="Todo")
        for index, (name, description) in enumerate(WORK_ITEMS, start=1):
            external_id = f"{MEETING['external_id']}:{index}"
            issue = Issue.objects.filter(workspace=workspace, external_source=SOURCE, external_id=external_id).first()
            if not issue:
                issue = Issue.objects.create(
                    workspace=workspace,
                    project=project,
                    state=todo,
                    name=name,
                    description_html=f"<p>{escape(description)}</p>",
                    external_source=SOURCE,
                    external_id=external_id,
                    created_by=owner,
                )
            MeetingWorkItem.objects.get_or_create(
                workspace=workspace,
                meeting=meeting,
                issue=issue,
                defaults={"created_by": owner},
            )

    def _placeholder_summary(self, inventory, digest):
        counts = ",".join(f"{name}={len(records)}" for name, records in inventory.items())
        ids = {name: [str(record["id"]) for record in records] for name, records in inventory.items()}
        encoded_ids = json.dumps(ids, separators=(",", ":"))
        return f" placeholders={counts} placeholder_ids={encoded_ids} placeholder_digest={digest}"

    def _count_summary(self, prefix, counts):
        return " ".join(f"{prefix}_{name}={count}" for name, count in counts.items())

    def _archive_placeholders(self, inventory):
        now = timezone.now()
        Project.objects.filter(id__in=[row["id"] for row in inventory["projects"]]).update(archived_at=now)
        Client.objects.filter(id__in=[row["id"] for row in inventory["clients"]]).update(deleted_at=now)
        Opportunity.objects.filter(id__in=[row["id"] for row in inventory["opportunities"]]).update(deleted_at=now)
        Meeting.objects.filter(id__in=[row["id"] for row in inventory["meetings"]]).update(deleted_at=now)
