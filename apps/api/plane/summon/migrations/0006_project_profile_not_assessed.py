# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("summon", "0005_assistantconversation_mcp_credential_and_more")]

    operations = [
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
