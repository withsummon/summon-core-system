# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re

# Django imports
from django.db import connections, models, router
from django.db.models import (
    Q,
    Value,
    UUIDField,
    CharField,
    BooleanField,
    ExpressionWrapper,
    When,
    Case,
)
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.search import TrigramWordSimilarity
from django.db.models.functions import Cast, Coalesce, Concat
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.views.base import BaseAPIView
from plane.app.permissions import WorkspaceUserPermission
from plane.db.models import (
    Workspace,
    Project,
    Issue,
    Cycle,
    Module,
    Page,
    IssueView,
    IntakeIssue,
    ProjectMember,
    ProjectPage,
    WorkspaceMember,
)
from plane.db.models.intake import IntakeIssueStatus


class GlobalSearchEndpoint(BaseAPIView):
    """Endpoint to search across multiple fields in the workspace and
    also show related workspace if found.

    Every word of the query must match a name by case-insensitive substring (``~*``) or trigram
    word similarity (``%>``), both served by the ``gin_trgm_ops`` indexes. Results rank exact
    phrase matches first, then by ``word_similarity``, so typos and partial words still match.
    """

    ISSUE_LIMIT = 25
    ENTITY_LIMIT = 10
    MIN_FUZZY_LENGTH = 3
    # pg_trgm's 0.6 default misses a single dropped letter in a typical word (``pemulhan``: 0.58).
    WORD_SIMILARITY_THRESHOLD = 0.55

    def member_project_ids(self, slug):
        return ProjectMember.objects.filter(
            member=self.request.user,
            is_active=True,
            project__archived_at__isnull=True,
            workspace__slug=slug,
        ).values("project_id")

    def ranked(self, queryset, query, fields, limit, pinned=None):
        """Name matches ordered best first, after any rows matched by ``pinned`` (identifiers,
        ``AURA-4`` references).

        ``pinned`` runs as its own query: OR-ing it into the name predicate stops Postgres from
        answering the name match from the trigram index alone.
        """
        if not query:
            return queryset.order_by("-created_at").values(*fields)[:limit]
        if len(query) < self.MIN_FUZZY_LENGTH and query.isdigit() and pinned is not None:
            # A short bare number is a sequence reference; scanning names for it rarely matches.
            matches = queryset.none()
        elif len(query) < self.MIN_FUZZY_LENGTH:
            # Too short for trigrams: ranking would score nearly every row, so match word starts by recency.
            matches = queryset.filter(name__iregex=rf"\m{re.escape(query)}").order_by("-created_at")
        else:
            # Every word must match, so each word's index lookup narrows the candidates to rank.
            matches = queryset.filter(*(self.word_match(word) for word in query.split()))
            matches = matches.annotate(
                phrase=ExpressionWrapper(Q(name__iregex=re.escape(query)), output_field=BooleanField()),
                rank=TrigramWordSimilarity(query, "name"),
            ).order_by("-phrase", "-rank", "-created_at")
        matches = list(matches.values(*fields)[:limit])
        if pinned is None:
            return matches
        pinned_rows = list(queryset.filter(pinned).order_by("-created_at").values(*fields)[:limit])
        pinned_ids = {row["id"] for row in pinned_rows}
        return (pinned_rows + [row for row in matches if row["id"] not in pinned_ids])[:limit]

    def word_match(self, word):
        if len(word) < self.MIN_FUZZY_LENGTH:
            return Q(name__iregex=rf"\m{re.escape(word)}")
        # ``icontains`` compiles to UPPER(name) LIKE, which the trigram index cannot serve; ``~*`` can.
        return Q(name__iregex=re.escape(word)) | Q(name__trigram_word_similar=word)

    def scoped(self, queryset, slug, project_id, workspace_search):
        queryset = queryset.filter(project_id__in=self.member_project_ids(slug))
        if workspace_search == "false" and project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def issue_reference_match(self, query, slug):
        """Match work item references such as ``AURA-4`` or a bare sequence number."""
        reference = re.fullmatch(r"([A-Za-z][A-Za-z0-9]*)-(\d+)", query)
        if reference:
            return Q(
                project_id__in=Project.objects.filter(workspace__slug=slug, identifier__iexact=reference[1]).values(
                    "id"
                ),
                sequence_id=reference[2],
            )
        # Match whole integers only (exclude decimal numbers)
        sequence_ids = re.findall(r"\b\d+\b", query)
        return Q(sequence_id__in=sequence_ids) if sequence_ids else None

    def filter_workspaces(self, query, _slug, _project_id, _workspace_search):
        return self.ranked(
            Workspace.objects.filter(
                id__in=WorkspaceMember.objects.filter(member=self.request.user, is_active=True).values("workspace_id")
            ),
            query,
            ["name", "id", "slug"],
            self.ENTITY_LIMIT,
        )

    def filter_projects(self, query, slug, _project_id, _workspace_search):
        return self.ranked(
            Project.objects.filter(id__in=self.member_project_ids(slug)),
            query,
            ["name", "id", "identifier", "workspace__slug"],
            self.ENTITY_LIMIT,
            pinned=Q(identifier__istartswith=query) if query else None,
        )

    def filter_issues(self, query, slug, project_id, workspace_search):
        return self.ranked(
            self.scoped(Issue.issue_objects.all(), slug, project_id, workspace_search),
            query,
            ["name", "id", "sequence_id", "project__identifier", "project_id", "workspace__slug"],
            self.ISSUE_LIMIT,
            pinned=self.issue_reference_match(query, slug) if query else None,
        )

    def filter_cycles(self, query, slug, project_id, workspace_search):
        return self.ranked(
            self.scoped(Cycle.objects.all(), slug, project_id, workspace_search),
            query,
            ["name", "id", "project_id", "project__identifier", "workspace__slug"],
            self.ENTITY_LIMIT,
        )

    def filter_modules(self, query, slug, project_id, workspace_search):
        return self.ranked(
            self.scoped(Module.objects.all(), slug, project_id, workspace_search),
            query,
            ["name", "id", "project_id", "project__identifier", "workspace__slug"],
            self.ENTITY_LIMIT,
        )

    def filter_pages(self, query, slug, project_id, workspace_search):
        page_projects = ProjectPage.objects.filter(project_id__in=self.member_project_ids(slug))
        if workspace_search == "false" and project_id:
            page_projects = page_projects.filter(project_id=project_id)

        pages = (
            Page.objects.filter(id__in=page_projects.values("page_id"))
            .annotate(
                project_ids=Coalesce(
                    ArrayAgg("projects__id", distinct=True, filter=~Q(projects__id=True)),
                    Value([], output_field=ArrayField(UUIDField())),
                )
            )
            .annotate(
                project_identifiers=Coalesce(
                    ArrayAgg(
                        "projects__identifier",
                        distinct=True,
                        filter=~Q(projects__id=True),
                    ),
                    Value([], output_field=ArrayField(CharField())),
                )
            )
        )
        return self.ranked(
            pages,
            query,
            ["name", "id", "project_ids", "project_identifiers", "workspace__slug"],
            self.ENTITY_LIMIT,
        )

    def filter_views(self, query, slug, project_id, workspace_search):
        return self.ranked(
            self.scoped(IssueView.objects.all(), slug, project_id, workspace_search),
            query,
            ["name", "id", "project_id", "project__identifier", "workspace__slug"],
            self.ENTITY_LIMIT,
        )

    def filter_intakes(self, query, slug, project_id, workspace_search):
        intake_issues = Issue.objects.filter(
            id__in=IntakeIssue.objects.filter(status__in=[IntakeIssueStatus.PENDING, IntakeIssueStatus.SNOOZED]).values(
                "issue_id"
            )
        )
        return self.ranked(
            self.scoped(intake_issues, slug, project_id, workspace_search),
            query,
            ["name", "id", "sequence_id", "project__identifier", "project_id", "workspace__slug"],
            self.ISSUE_LIMIT,
            pinned=self.issue_reference_match(query, slug) if query else None,
        )

    def get(self, request, slug):
        query = request.query_params.get("search", "").strip()
        entities_param = request.query_params.get("entities")
        workspace_search = request.query_params.get("workspace_search", "false")
        project_id = request.query_params.get("project_id", False)

        MODELS_MAPPER = {
            "workspace": self.filter_workspaces,
            "project": self.filter_projects,
            "issue": self.filter_issues,
            "cycle": self.filter_cycles,
            "module": self.filter_modules,
            "issue_view": self.filter_views,
            "page": self.filter_pages,
            "intake": self.filter_intakes,
        }

        # Determine which entities to search
        if entities_param:
            requested_entities = [e.strip() for e in entities_param.split(",") if e.strip()]
            requested_entities = [e for e in requested_entities if e in MODELS_MAPPER]
        else:
            requested_entities = list(MODELS_MAPPER.keys())

        # ``%>`` reads its cutoff from this session setting, so set it on the connection that serves reads.
        with connections[router.db_for_read(Issue)].cursor() as cursor:
            cursor.execute("SET pg_trgm.word_similarity_threshold = %s", [self.WORD_SIMILARITY_THRESHOLD])

        results = {}

        for entity in requested_entities:
            func = MODELS_MAPPER.get(entity)
            if func:
                results[entity] = func(query or None, slug, project_id, workspace_search)

        return Response({"results": results}, status=status.HTTP_200_OK)


class SearchEndpoint(BaseAPIView):
    permission_classes = (WorkspaceUserPermission,)

    def get(self, request, slug):
        query = request.query_params.get("query", False)
        query_types = request.query_params.get("query_type", "user_mention").split(",")
        query_types = [qt.strip() for qt in query_types]
        count = int(request.query_params.get("count", 5))
        project_id = request.query_params.get("project_id", None)

        response_data = {}

        if project_id:
            for query_type in query_types:
                if query_type == "user_mention":
                    fields = [
                        "member__first_name",
                        "member__last_name",
                        "member__display_name",
                    ]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})

                    users = (
                        ProjectMember.objects.filter(
                            q,
                            is_active=True,
                            workspace__slug=slug,
                            member__is_bot=False,
                            project_id=project_id,
                        )
                        .annotate(
                            member__avatar_url=Case(
                                When(
                                    member__avatar_asset__isnull=False,
                                    then=Concat(
                                        Value("/api/assets/v2/static/"),
                                        Cast("member__avatar_asset", CharField()),
                                        Value("/"),
                                    ),
                                ),
                                When(
                                    member__avatar_asset__isnull=True,
                                    then="member__avatar",
                                ),
                                default=Value(None),
                                output_field=CharField(),
                            )
                        )
                        .order_by("-created_at")
                    )

                    users = users.distinct().values(
                        "member__avatar_url",
                        "member__display_name",
                        "member__id",
                    )

                    response_data["user_mention"] = list(users[:count])

                elif query_type == "project":
                    fields = ["name", "identifier"]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})
                    projects = (
                        Project.objects.filter(
                            q,
                            Q(project_projectmember__member=self.request.user) | Q(network=2),
                            workspace__slug=slug,
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values("name", "id", "identifier", "logo_props", "workspace__slug")[:count]
                    )
                    response_data["project"] = list(projects)

                elif query_type == "issue":
                    fields = ["name", "sequence_id", "project__identifier"]
                    q = Q()

                    if query:
                        for field in fields:
                            if field == "sequence_id":
                                sequences = re.findall(r"\b\d+\b", query)
                                for sequence_id in sequences:
                                    q |= Q(**{"sequence_id": sequence_id})
                            else:
                                q |= Q(**{f"{field}__icontains": query})

                    issues = (
                        Issue.issue_objects.filter(
                            q,
                            project__project_projectmember__member=self.request.user,
                            project__project_projectmember__is_active=True,
                            workspace__slug=slug,
                            project_id=project_id,
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values(
                            "name",
                            "id",
                            "sequence_id",
                            "project__identifier",
                            "project_id",
                            "priority",
                            "state_id",
                            "type_id",
                        )[:count]
                    )
                    response_data["issue"] = list(issues)

                elif query_type == "cycle":
                    fields = ["name"]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})

                    cycles = (
                        Cycle.objects.filter(
                            q,
                            project__project_projectmember__member=self.request.user,
                            project__project_projectmember__is_active=True,
                            workspace__slug=slug,
                            project_id=project_id,
                        )
                        .annotate(
                            status=Case(
                                When(
                                    Q(start_date__lte=timezone.now()) & Q(end_date__gte=timezone.now()),
                                    then=Value("CURRENT"),
                                ),
                                When(
                                    start_date__gt=timezone.now(),
                                    then=Value("UPCOMING"),
                                ),
                                When(end_date__lt=timezone.now(), then=Value("COMPLETED")),
                                When(
                                    Q(start_date__isnull=True) & Q(end_date__isnull=True),
                                    then=Value("DRAFT"),
                                ),
                                default=Value("DRAFT"),
                                output_field=CharField(),
                            )
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values(
                            "name",
                            "id",
                            "project_id",
                            "project__identifier",
                            "status",
                            "workspace__slug",
                        )[:count]
                    )
                    response_data["cycle"] = list(cycles)

                elif query_type == "module":
                    fields = ["name"]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})

                    modules = (
                        Module.objects.filter(
                            q,
                            project__project_projectmember__member=self.request.user,
                            project__project_projectmember__is_active=True,
                            workspace__slug=slug,
                            project_id=project_id,
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values(
                            "name",
                            "id",
                            "project_id",
                            "project__identifier",
                            "status",
                            "workspace__slug",
                        )[:count]
                    )
                    response_data["module"] = list(modules)

                elif query_type == "page":
                    fields = ["name"]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})

                    pages = (
                        Page.objects.filter(
                            q,
                            projects__project_projectmember__member=self.request.user,
                            projects__project_projectmember__is_active=True,
                            projects__id=project_id,
                            workspace__slug=slug,
                            access=0,
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values(
                            "name",
                            "id",
                            "logo_props",
                            "projects__id",
                            "workspace__slug",
                        )[:count]
                    )
                    response_data["page"] = list(pages)
            return Response(response_data, status=status.HTTP_200_OK)

        else:
            for query_type in query_types:
                if query_type == "user_mention":
                    fields = [
                        "member__first_name",
                        "member__last_name",
                        "member__display_name",
                    ]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})
                    users = (
                        WorkspaceMember.objects.filter(
                            q,
                            is_active=True,
                            workspace__slug=slug,
                            member__is_bot=False,
                        )
                        .annotate(
                            member__avatar_url=Case(
                                When(
                                    member__avatar_asset__isnull=False,
                                    then=Concat(
                                        Value("/api/assets/v2/static/"),
                                        Cast("member__avatar_asset", models.CharField()),
                                        Value("/"),
                                    ),
                                ),
                                When(
                                    member__avatar_asset__isnull=True,
                                    then="member__avatar",
                                ),
                                default=Value(None),
                                output_field=models.CharField(),
                            )
                        )
                        .order_by("-created_at")
                        .values("member__avatar_url", "member__display_name", "member__id")[:count]
                    )
                    response_data["user_mention"] = list(users)

                elif query_type == "project":
                    fields = ["name", "identifier"]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})
                    projects = (
                        Project.objects.filter(
                            q,
                            Q(project_projectmember__member=self.request.user) | Q(network=2),
                            workspace__slug=slug,
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values("name", "id", "identifier", "logo_props", "workspace__slug")[:count]
                    )
                    response_data["project"] = list(projects)

                elif query_type == "issue":
                    fields = ["name", "sequence_id", "project__identifier"]
                    q = Q()

                    if query:
                        for field in fields:
                            if field == "sequence_id":
                                sequences = re.findall(r"\b\d+\b", query)
                                for sequence_id in sequences:
                                    q |= Q(**{"sequence_id": sequence_id})
                            else:
                                q |= Q(**{f"{field}__icontains": query})

                    issues = (
                        Issue.issue_objects.filter(
                            q,
                            project__project_projectmember__member=self.request.user,
                            project__project_projectmember__is_active=True,
                            workspace__slug=slug,
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values(
                            "name",
                            "id",
                            "sequence_id",
                            "project__identifier",
                            "project_id",
                            "priority",
                            "state_id",
                            "type_id",
                        )[:count]
                    )
                    response_data["issue"] = list(issues)

                elif query_type == "cycle":
                    fields = ["name"]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})

                    cycles = (
                        Cycle.objects.filter(
                            q,
                            project__project_projectmember__member=self.request.user,
                            project__project_projectmember__is_active=True,
                            workspace__slug=slug,
                        )
                        .annotate(
                            status=Case(
                                When(
                                    Q(start_date__lte=timezone.now()) & Q(end_date__gte=timezone.now()),
                                    then=Value("CURRENT"),
                                ),
                                When(
                                    start_date__gt=timezone.now(),
                                    then=Value("UPCOMING"),
                                ),
                                When(end_date__lt=timezone.now(), then=Value("COMPLETED")),
                                When(
                                    Q(start_date__isnull=True) & Q(end_date__isnull=True),
                                    then=Value("DRAFT"),
                                ),
                                default=Value("DRAFT"),
                                output_field=CharField(),
                            )
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values(
                            "name",
                            "id",
                            "project_id",
                            "project__identifier",
                            "status",
                            "workspace__slug",
                        )[:count]
                    )
                    response_data["cycle"] = list(cycles)

                elif query_type == "module":
                    fields = ["name"]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})

                    modules = (
                        Module.objects.filter(
                            q,
                            project__project_projectmember__member=self.request.user,
                            project__project_projectmember__is_active=True,
                            workspace__slug=slug,
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values(
                            "name",
                            "id",
                            "project_id",
                            "project__identifier",
                            "status",
                            "workspace__slug",
                        )[:count]
                    )
                    response_data["module"] = list(modules)

                elif query_type == "page":
                    fields = ["name"]
                    q = Q()

                    if query:
                        for field in fields:
                            q |= Q(**{f"{field}__icontains": query})

                    pages = (
                        Page.objects.filter(
                            q,
                            projects__project_projectmember__member=self.request.user,
                            projects__project_projectmember__is_active=True,
                            workspace__slug=slug,
                            access=0,
                            is_global=True,
                        )
                        .order_by("-created_at")
                        .distinct()
                        .values(
                            "name",
                            "id",
                            "logo_props",
                            "projects__id",
                            "workspace__slug",
                        )[:count]
                    )
                    response_data["page"] = list(pages)
            return Response(response_data, status=status.HTTP_200_OK)
