"""Compare Convex export records and stored bytes without printing private data.

Usage: python3 tools/benchmarks/compare-convex-snapshots.py source.zip restored.zip
Exports contain credentials and private records; keep them outside the repository.
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path


def contents(path):
    with zipfile.ZipFile(path) as archive:
        rows = {
            name: sorted(
                (json.loads(line) for line in archive.read(name).splitlines() if line),
                key=lambda row: row["_id"],
            )
            for name in archive.namelist()
            if name.endswith("/documents.jsonl") and not name.endswith("_tables/documents.jsonl")
        }
        files = {
            name: hashlib.sha256(archive.read(name)).hexdigest()
            for name in archive.namelist()
            if "_storage/" in name
            and not name.endswith("/")
            and not name.endswith("/documents.jsonl")
        }
    return rows, files


source = Path(sys.argv[1])
restored = Path(sys.argv[2])
source_rows, source_files = contents(source)
restored_rows, restored_files = contents(restored)
receipt = {
    "tableCount": len(source_rows),
    "documentCount": sum(map(len, source_rows.values())),
    "canonicalRowsEqual": source_rows == restored_rows,
    "storedFileCount": len(source_files),
    "storedFileBytesEqual": source_files == restored_files,
    "sourceSnapshotSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
}
print(json.dumps(receipt, indent=2))
sys.exit(0 if receipt["canonicalRowsEqual"] and receipt["storedFileBytesEqual"] else 1)
