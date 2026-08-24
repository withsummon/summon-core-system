# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("summon", "0005_assistantconversation_mcp_credential_and_more")]

    operations = [
        migrations.AddField(
            model_name="client",
            name="external_id",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="client",
            name="external_source",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="meeting",
            name="external_id",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="meeting",
            name="external_source",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="automationtemplate",
            name="external_id",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="automationtemplate",
            name="external_source",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name="summonprojectprofile",
            name="delivery_status",
            field=models.CharField(
                choices=[
                    ("not_assessed", "Not assessed"),
                    ("planning", "Planning"),
                    ("active", "Active"),
                    ("on_hold", "On hold"),
                    ("completed", "Completed"),
                ],
                default="not_assessed",
                max_length=24,
            ),
        ),
        migrations.AlterField(
            model_name="summonprojectprofile",
            name="health",
            field=models.CharField(
                choices=[
                    ("not_assessed", "Not assessed"),
                    ("on_track", "On track"),
                    ("at_risk", "At risk"),
                    ("off_track", "Off track"),
                ],
                default="not_assessed",
                max_length=16,
            ),
        ),
    ]
