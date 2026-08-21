# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from plane.db.models import BaseModel


class Client(BaseModel):
    class Status(models.TextChoices):
        LEAD = "lead", "Lead"
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_clients")
    owner = models.ForeignKey("db.User", null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    industry = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.LEAD)

    class Meta:
        ordering = ("name",)
        constraints = [models.UniqueConstraint(fields=("workspace", "name"), name="summon_unique_client_name")]


class ClientContact(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_client_contacts")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("workspace", "client", "email"),
                condition=~models.Q(email=""),
                name="summon_unique_client_contact_email",
            )
        ]


class Opportunity(BaseModel):
    class Stage(models.TextChoices):
        LEAD = "lead", "Lead"
        QUALIFIED = "qualified", "Qualified"
        PROPOSAL = "proposal", "Proposal"
        NEGOTIATION = "negotiation", "Negotiation"
        WON = "won", "Won"
        LOST = "lost", "Lost"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_opportunities")
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL, related_name="opportunities")
    owner = models.ForeignKey("db.User", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    stage = models.CharField(max_length=20, choices=Stage.choices, default=Stage.LEAD)
    value = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    probability = models.PositiveSmallIntegerField(default=0)
    expected_close_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("workspace", "client", "title"),
                name="summon_unique_opportunity_identity",
                nulls_distinct=False,
            ),
            models.CheckConstraint(
                condition=models.Q(probability__gte=0, probability__lte=100),
                name="summon_opportunity_probability_range",
            ),
        ]


class SummonProjectProfile(BaseModel):
    class DeliveryStatus(models.TextChoices):
        PLANNING = "planning", "Planning"
        ACTIVE = "active", "Active"
        ON_HOLD = "on_hold", "On hold"
        COMPLETED = "completed", "Completed"

    class ProjectHealth(models.TextChoices):
        ON_TRACK = "on_track", "On track"
        AT_RISK = "at_risk", "At risk"
        OFF_TRACK = "off_track", "Off track"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_project_profiles")
    project = models.OneToOneField("db.Project", on_delete=models.CASCADE, related_name="summon_profile")
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL, related_name="projects")
    source_opportunity = models.OneToOneField(
        Opportunity,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="converted_project_profile",
    )
    delivery_status = models.CharField(
        max_length=24,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PLANNING,
    )
    phase = models.CharField(max_length=80, blank=True)
    health = models.CharField(max_length=16, choices=ProjectHealth.choices, default=ProjectHealth.ON_TRACK)
    start_date = models.DateField(null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
