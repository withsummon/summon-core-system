# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest import mock

import pytest
from django.core.management import call_command


@pytest.mark.unit
def test_prepare_api_runs_every_startup_step_in_order():
    with mock.patch("plane.db.management.commands.prepare_api.call_command") as step:
        call_command("prepare_api", "signature")

    assert step.call_args_list == [
        mock.call("wait_for_db"),
        mock.call("wait_for_migrations"),
        mock.call("register_instance", "signature"),
        mock.call("configure_instance"),
        mock.call("create_bucket"),
        mock.call("clear_cache"),
        mock.call("collectstatic", interactive=False),
    ]


@pytest.mark.unit
def test_prepare_api_stops_at_the_first_failing_step():
    def run(name, *args, **kwargs):
        if name == "wait_for_migrations":
            raise RuntimeError("database unreachable")

    with mock.patch("plane.db.management.commands.prepare_api.call_command", side_effect=run) as step:
        with pytest.raises(RuntimeError):
            call_command("prepare_api", "signature")

    assert [call.args[0] for call in step.call_args_list] == ["wait_for_db", "wait_for_migrations"]
