"""Bounded workspace export formatting; the caller owns all source authorization."""

import base64
import io
import re
import zipfile

from plane.utils.porters.exporter import DataExporter


def export_workspace(data):
    if not isinstance(data, dict) or set(data) != {"format", "name", "files"}:
        raise ValueError("Invalid export request.")
    if data["format"] not in DataExporter.FORMATTERS:
        raise ValueError("Unsupported export format.")
    if not isinstance(data["name"], str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,240}", data["name"]):
        raise ValueError("Invalid export filename.")
    if not isinstance(data["files"], list) or not data["files"]:
        raise ValueError("Choose export files.")
    formatter = DataExporter.FORMATTERS[data["format"]](**({"list_joiner": ", "} if data["format"] == "xlsx" else {}))
    names = set()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in data["files"]:
            if not isinstance(file, dict) or set(file) != {"name", "records"}:
                raise ValueError("Invalid export file.")
            name = file["name"]
            if not isinstance(name, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,240}", name) or name in names:
                raise ValueError("Invalid or duplicate export filename.")
            names.add(name)
            records = file["records"]
            if not isinstance(records, list) or not all(isinstance(row, dict) for row in records):
                raise ValueError("Invalid export records.")
            archive.writestr(f"{name}.{formatter.extension}", formatter.encode(records))
    result = buffer.getvalue()
    if len(result) > 10 * 1024 * 1024:
        raise ValueError("Export ZIP exceeds 10 MB.")
    return {"name": f'{data["name"]}.zip', "base64": base64.b64encode(result).decode("ascii")}
