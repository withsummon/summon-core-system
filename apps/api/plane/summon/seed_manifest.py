# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.utils.html import escape

PROJECTS = (
    {
        "name": "BSB Logistics Management",
        "identifier": "BSB-LMS",
        "repository": "bsb-management-logistic",
        "client": "PT. BSB dan PT. BSB2",
        "summary": "Sistem manajemen logistik end-to-end untuk operasional PT BSB dan PT BSB2.",
        "snapshot": "bdbbab2 (2026-08-24)",
        "live_url": "https://bsb-management-logistic.withsummon.com",
    },
    {
        "name": "Batu Alam Inventory System",
        "identifier": "BATU-ALAM",
        "repository": "batu-alam",
        "client": "PT Batu Alam Nusantara",
        "summary": "Sistem inventori untuk pencatatan dan pengelolaan persediaan batu alam.",
        "snapshot": "b75da24 (2026-07-06)",
    },
    {
        "name": "MMF Core",
        "identifier": "MMF-CORE",
        "repository": "mmf-core",
        "client": "PT Mutiara Multi Finance",
        "summary": "Aplikasi core operasional PT Mutiara Multi Finance untuk pelaksanaan Tahap 1.",
        "snapshot": "5b19e49 (2026-08-19)",
        "live_url": "https://mmf-core.withsummon.com",
    },
    {
        "name": "PLN Policy Vault API",
        "identifier": "PLN-ECM",
        "repository": "pln-ecm-be",
        "client": "PLN Insurance",
        "summary": "API pengelolaan dan pencarian dokumen polis untuk DMS Asuransi PLN.",
        "snapshot": "2978219 (2026-06-10)",
    },
    {
        "name": "PLN Policy Vault",
        "identifier": "PLN-VAULT",
        "repository": "pln-policy-vault",
        "client": "PLN Insurance",
        "summary": "Portal DMS untuk penyimpanan, pengindeksan, dan pencarian dokumen polis Asuransi PLN.",
        "snapshot": "cb769a4 (2026-06-09)",
    },
    {
        "name": "Portal Supplier",
        "identifier": "SUPPLIER",
        "repository": "portal-supplier",
        "client": "PT Summon Cipta Inovasi",
        "summary": "Portal internal untuk pengelolaan informasi dan aktivitas supplier.",
        "snapshot": "a4fab0a (2026-07-23)",
    },
    {
        "name": "VIDEI Agent Document Portal",
        "identifier": "VIDEI",
        "repository": "videi-portal",
        "client": "PT Asuransi Umum VIDEI",
        "summary": "Portal prototype agen untuk mengakses dan mengelola dokumen Asuransi Umum VIDEI.",
        "snapshot": "49cb241 (2026-08-18)",
        "live_url": "https://videi.withsummon.com",
    },
    {
        "name": "AURA Backend",
        "identifier": "AURA",
        "repository": "aura-backend",
        "client": "PT Surya Artha Nusantara Finance",
        "summary": "Backend FastAPI stateless untuk layanan AURA milik Surya Artha Nusantara Finance.",
        "snapshot": "174ccab (2026-07-27)",
    },
    {
        "name": "Sucofindo Handwritten Report OCR",
        "identifier": "SUCO-OCR",
        "repository": "sucofindo-ocr",
        "client": "Sucofindo",
        "summary": "Proof of concept OCR untuk ekstraksi isi laporan tulisan tangan Sucofindo.",
        "snapshot": "e6bee65 (2026-08-21)",
    },
    {
        "name": "Summon Core System",
        "identifier": "SUMMON",
        "repository": "summon-core-system",
        "client": "PT Summon Cipta Inovasi",
        "summary": (
            "Workspace operasional terpadu untuk proyek, klien, rapat, resource, automation, dan laporan Summon."
        ),
        "snapshot": "f88b938538 (2026-08-24)",
        "live_url": "https://summon-core.withsummon.com",
    },
)

MEETING = {
    "external_id": "meeting:pln-demo-2026-03-04",
    "title": "Demo Internal DMS Asuransi PLN ke Iglo",
    "starts_at": "2026-03-04T10:00:00+07:00",
    "ends_at": "2026-03-04T10:42:00+07:00",
    "project_identifier": "PLN-VAULT",
    "project_repository": "pln-policy-vault",
    "agenda": "Demo internal dan pembahasan kesiapan DMS Asuransi PLN.",
    "notes": "Tindak lanjut Tim Summon disalin dari notulen tanpa menambahkan assignee atau due date.",
    "location": "Zoom Meeting",
}

WORK_ITEMS = (
    (
        "Siapkan roadmap untuk bahan offering ke PLN",
        "Siapkan roadmap implementasi sebagai bahan offering lanjutan kepada PLN.",
    ),
    (
        "Rumuskan skema metadata indexing dan contoh prompting retrieval",
        "Rumuskan skema metadata indexing beserta contoh prompting untuk proses retrieval dokumen.",
    ),
    (
        "Finalisasi pendekatan OCR extraction",
        "Finalisasi pendekatan OCR extraction untuk dokumen yang menjadi ruang lingkup DMS.",
    ),
    (
        "Siapkan bahan teknis high-level",
        "Siapkan bahan teknis high-level untuk pembahasan dan offering berikutnya.",
    ),
)


def repository_id(item):
    return f"github:withsummon/{item['repository']}"


def client_id(name):
    return f"client:{name}"


def page_html(item):
    repository_url = f"https://github.com/withsummon/{item['repository']}"
    rows = (
        ("Client", escape(item["client"])),
        ("Fungsi sistem", escape(item["summary"])),
        ("Commit snapshot", escape(item["snapshot"])),
        ("Source", f'<a href="{repository_url}">{repository_url}</a>'),
    )
    return "<h1>Project Brief</h1>" + "".join(f"<p><strong>{label}:</strong> {value}</p>" for label, value in rows)
