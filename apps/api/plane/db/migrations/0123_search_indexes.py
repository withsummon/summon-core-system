from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.operations import AddIndexConcurrently, TrigramExtension
from django.db import migrations, models


class Migration(migrations.Migration):
    # CREATE INDEX CONCURRENTLY cannot run inside a transaction.
    atomic = False

    dependencies = [
        ("db", "0122_alter_draftissue_assignees_alter_issue_assignees_and_more"),
    ]

    operations = [
        TrigramExtension(),
        AddIndexConcurrently(
            model_name="issue",
            index=GinIndex(fields=["name"], name="issue_name_trgm_idx", opclasses=["gin_trgm_ops"]),
        ),
        AddIndexConcurrently(
            model_name="issue",
            index=models.Index(fields=["project", "sequence_id"], name="issue_project_sequence_idx"),
        ),
        AddIndexConcurrently(
            model_name="cycle",
            index=GinIndex(fields=["name"], name="cycle_name_trgm_idx", opclasses=["gin_trgm_ops"]),
        ),
        AddIndexConcurrently(
            model_name="module",
            index=GinIndex(fields=["name"], name="module_name_trgm_idx", opclasses=["gin_trgm_ops"]),
        ),
        AddIndexConcurrently(
            model_name="page",
            index=GinIndex(fields=["name"], name="page_name_trgm_idx", opclasses=["gin_trgm_ops"]),
        ),
        AddIndexConcurrently(
            model_name="issueview",
            index=GinIndex(fields=["name"], name="issue_view_name_trgm_idx", opclasses=["gin_trgm_ops"]),
        ),
    ]
