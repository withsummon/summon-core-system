import json
from zoneinfo import ZoneInfo

from django.utils import timezone

from plane.app.services.llm import LLMError
from plane.summon.models import SummonProjectProfile


SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "decisions": {"type": "array", "items": {"type": "string"}},
        "action_suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"title": {"type": "string"}, "details": {"type": "string"}},
                "required": ["title", "details"],
                "additionalProperties": False,
            },
        },
        "discussion_topics": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "details": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["topic", "details"],
                "additionalProperties": False,
            },
        },
        "todos_by_party": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "party": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"task": {"type": "string"}, "notes": {"type": "string"}},
                            "required": ["task", "notes"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["party", "items"],
                "additionalProperties": False,
            },
        },
        "open_items": {"type": "array", "items": {"type": "string"}},
        "next_actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "owner": {"type": "string"},
                    "due_date": {"type": "string"},
                },
                "required": ["action", "owner", "due_date"],
                "additionalProperties": False,
            },
        },
    },
    "required": [
        "summary",
        "decisions",
        "action_suggestions",
        "discussion_topics",
        "todos_by_party",
        "open_items",
        "next_actions",
    ],
    "additionalProperties": False,
}


def validate_mom_response(text):
    try:
        data = json.loads(text)
        summary = data["summary"].strip()
        decisions = [item.strip() for item in data["decisions"] if isinstance(item, str) and item.strip()]
        suggestions = [
            {"title": item["title"].strip(), "details": item["details"].strip()}
            for item in data["action_suggestions"]
            if isinstance(item, dict) and isinstance(item.get("title"), str) and isinstance(item.get("details"), str)
        ]
        topics = [
            {
                "topic": item["topic"].strip(),
                "details": [detail.strip() for detail in item["details"] if isinstance(detail, str) and detail.strip()],
            }
            for item in data.get("discussion_topics", [])
            if isinstance(item, dict) and isinstance(item.get("topic"), str) and isinstance(item.get("details"), list)
        ]
        todos = [
            {
                "party": group["party"].strip(),
                "items": [
                    {"task": item["task"].strip(), "notes": item["notes"].strip()}
                    for item in group["items"]
                    if isinstance(item, dict)
                    and isinstance(item.get("task"), str)
                    and isinstance(item.get("notes"), str)
                    and item["task"].strip()
                ],
            }
            for group in data.get("todos_by_party", [])
            if isinstance(group, dict) and isinstance(group.get("party"), str) and isinstance(group.get("items"), list)
        ]
        open_items = [item.strip() for item in data.get("open_items", []) if isinstance(item, str) and item.strip()]
        next_actions = [
            {
                "action": item["action"].strip(),
                "owner": item["owner"].strip(),
                "due_date": item["due_date"].strip(),
            }
            for item in data.get("next_actions", [])
            if isinstance(item, dict)
            and isinstance(item.get("action"), str)
            and isinstance(item.get("owner"), str)
            and isinstance(item.get("due_date"), str)
            and item["action"].strip()
        ]
    except (AttributeError, KeyError, TypeError, ValueError):
        raise LLMError("llm_invalid_response") from None
    if (
        not summary
        or len(suggestions) != len(data["action_suggestions"])
        or any(not item["title"] for item in suggestions)
    ):
        raise LLMError("llm_invalid_response")
    return {
        "summary": summary,
        "decisions": decisions,
        "action_suggestions": suggestions,
        "discussion_topics": topics,
        "todos_by_party": todos,
        "open_items": open_items,
        "next_actions": next_actions,
    }


def _cell(value):
    return value.replace("|", "\\|").replace("\n", " ")


def render_mom_markdown(meeting, result):
    jakarta = ZoneInfo("Asia/Jakarta")
    start = timezone.localtime(meeting.starts_at, jakarta)
    end = timezone.localtime(meeting.ends_at, jakarta) if meeting.ends_at else None
    profile = (
        SummonProjectProfile.objects.filter(project_id=meeting.project_id, deleted_at__isnull=True)
        .select_related("client")
        .first()
    )
    participants = ", ".join(
        meeting.participants.select_related("member").values_list("member__display_name", flat=True)
    )
    lines = [
        "# MINUTES OF MEETING",
        "",
        "**PT Summon Cipta Inovasi**",
        "",
        "| Metadata | Detail |",
        "|---|---|",
        f"| Project | {_cell(meeting.project.name)} |",
        f"| Client | {_cell(profile.client.name) if profile and profile.client else 'Tidak tercantum'} |",
        "| Nomor Dokumen | Tidak tercantum |",
        f"| Topik | {_cell(meeting.title)} |",
        f"| Tanggal | {start:%Y-%m-%d} |",
        f"| Waktu | {start:%H:%M}{f'–{end:%H:%M}' if end else ''} WIB |",
        f"| Tempat | {_cell(meeting.location) if meeting.location else 'Tidak tercantum'} |",
        f"| Peserta | {_cell(participants) if participants else 'Tidak tercantum'} |",
    ]
    for group in result["todos_by_party"]:
        lines.extend(["", f"## TO-DO LIST — {group['party']}", "", "| No | Tugas | Keterangan |", "|---:|---|---|"])
        lines.extend(
            f"| {index} | {_cell(item['task'])} | {_cell(item['notes']) or 'Tidak tercantum'} |"
            for index, item in enumerate(group["items"], 1)
        )
        if not group["items"]:
            lines.append("| 1 | Tidak ada tindak lanjut yang tercatat | — |")
    if not result["todos_by_party"]:
        lines.extend(
            [
                "",
                "## TO-DO LIST",
                "",
                "| No | Tugas | Keterangan |",
                "|---:|---|---|",
                "| 1 | Tidak ada tindak lanjut yang tercatat | — |",
            ]
        )
    lines.extend(["", "## RINGKASAN PEMBAHASAN"])
    if result["discussion_topics"]:
        for topic in result["discussion_topics"]:
            lines.extend(["", f"### {topic['topic']}"])
            lines.extend([f"- {detail}" for detail in topic["details"]] or ["- Tidak ada detail yang tercatat."])
    else:
        lines.extend(["", result["summary"]])
    lines.extend(["", "## KEPUTUSAN"])
    lines.extend([f"- {item}" for item in result["decisions"]] or ["- Tidak ada keputusan yang tercatat."])
    lines.extend(["", "## OPEN ITEMS"])
    lines.extend([f"- {item}" for item in result["open_items"]] or ["- Tidak ada open item yang tercatat."])
    lines.extend(["", "## NEXT ACTIONS", "", "| No | Tindakan | PIC | Tenggat |", "|---:|---|---|---|"])
    lines.extend(
        "| {} | {} | {} | {} |".format(
            index,
            _cell(item["action"]),
            _cell(item["owner"]) or "Tidak tercantum",
            _cell(item["due_date"]) or "Tidak tercantum",
        )
        for index, item in enumerate(result["next_actions"], 1)
    )
    if not result["next_actions"]:
        lines.append("| 1 | Tidak ada next action yang tercatat | — | — |")
    return "\n".join(lines)
