# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run the API's startup steps in one process before the server starts"

    def add_arguments(self, parser):
        parser.add_argument("machine_signature", type=str, help="Machine signature")

    def handle(self, *args, **options):
        # Each step used to run as its own `manage.py` process and paid Django's ~5 s startup every time,
        # which kept the API down for most of a minute on every deploy.
        call_command("wait_for_db")
        call_command("wait_for_migrations")
        call_command("register_instance", options["machine_signature"])
        call_command("configure_instance")
        call_command("create_bucket")
        call_command("clear_cache")
        call_command("collectstatic", interactive=False)
