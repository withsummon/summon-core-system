# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import binascii
from functools import partial

from django.db import transaction
from rest_framework import serializers

from plane.bgtasks import copy_s3_object, page_transaction_task
from plane.utils.content_validator import validate_binary_data


def write_page_document(page, description_html, metadata):
    document = copy_s3_object.sync_with_external_service("PAGE", description_html)
    try:
        description_json = document["description_json"]
        description_binary = base64.b64decode(document["description_binary"], validate=True)
    except (binascii.Error, KeyError, TypeError, ValueError):
        raise serializers.ValidationError(
            {"page": "Plane Page document conversion is unavailable. Retry when Plane Live is healthy."}
        ) from None
    valid_binary, _ = validate_binary_data(description_binary)
    if not isinstance(description_json, dict) or not valid_binary:
        raise serializers.ValidationError({"page": "Plane Page document conversion returned invalid content."})

    created = page._state.adding
    old_description_html = None if created else page.description_html
    page.description_json = description_json
    page.description_binary = description_binary
    page.description_html = description_html
    page.view_props = {
        **(page.view_props if isinstance(page.view_props, dict) else {}),
        "summon_document": metadata,
    }
    page.save()
    transaction.on_commit(
        partial(
            page_transaction_task.page_transaction.delay,
            new_description_html=description_html,
            old_description_html=old_description_html,
            page_id=page.id,
        ),
        robust=True,
    )
    return page


def summon_document_metadata(page):
    view_props = page.view_props if page and isinstance(page.view_props, dict) else {}
    metadata = view_props.get("summon_document")
    if isinstance(metadata, dict):
        return metadata
    return page.description_json if page and isinstance(page.description_json, dict) else {}
