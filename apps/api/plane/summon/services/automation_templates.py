# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

DEFAULT_TEMPLATES = {
    "usage_cost": (
        "Usage Cost",
        ["title", "period", "exchange_rate"],
        "Susun laporan biaya penggunaan bertabel dengan kolom Timestamp, Session, Source, Minutes, Input Tokens, Output Tokens, Total Tokens, STT Cost USD, LLM Cost USD, Total USD, Exchange Rate IDR/USD, dan Total IDR; sertakan ringkasan periode dan total tanpa mengarang angka.",  # noqa: E501
    ),
    "mom_iglo": (
        "Minutes of Meeting - IGLO",
        ["title", "project", "client", "document_number", "topic", "date", "time", "place", "parties"],
        "Susun MoM IGLO dengan identitas Project, Client, Document No, Topic, Date, Time, Place; tabel To Do terpisah per pihak berkolom No/Tugas/Keterangan; Discussion, Decisions, Open Items, dan Next Schedule. Nyatakan arahan visual marun dan kuning IGLO.",  # noqa: E501
    ),
    "mom_summon": (
        "Minutes of Meeting - Summon",
        ["title", "project", "client", "document_number", "topic", "date", "time", "place", "parties"],
        "Susun MoM dengan corporate header Summon; identitas Project, Client, Document No, Topic, Date, Time, Place; tabel To Do terpisah per pihak berkolom No/Tugas/Keterangan; Discussion, Decisions, Open Items, dan Next Schedule.",  # noqa: E501
    ),
    "proposal_vendor": (
        "Vendor Proposal",
        ["title", "client", "request", "scope", "timeline", "resources"],
        "Susun deck Technical Proposal vendor per slide: Cover, Disclaimer, Table of Contents, About Us, Our Services, Executive Summary, Objectives/Value Proposition, Client Request Detail, Scope of Work, Out of Scope, Success Criteria & Deliverables, Detailed Features, Technical Architecture, Timeline, Resource Allocation, Important Notes, dan Appendix berisi portfolio hanya bila tersedia di konteks. Jangan menambahkan bagian harga atau nilai komersial.",  # noqa: E501
    ),
    "proposal_client": (
        "Client Proposal",
        ["title", "client", "request", "scope", "timeline", "resources", "pricing"],
        "Susun deck Technical Proposal klien per slide: Cover, Disclaimer, Table of Contents, About Us, Our Services, Executive Summary, Objectives/Value Proposition, Client Request Detail, Scope of Work, Out of Scope, Success Criteria & Deliverables, Detailed Features, Technical Architecture, Timeline, Resource Allocation, Pricing Scheme, Important Notes, dan Appendix berisi portfolio hanya bila tersedia di konteks.",  # noqa: E501
    ),
    "invoice": (
        "Invoice",
        ["title", "invoice_number", "issue_date", "due_date", "client", "items", "currency", "payment_details"],
        "Susun invoice Summon formal: nomor/tanggal/jatuh tempo, Bill From dan Bill To, tabel item Description/Qty/Unit Rate/Amount, Subtotal, Tax, Total dan Currency, payment/bank details, notes, serta signature; jangan menghitung nilai yang tidak diberikan.",  # noqa: E501
    ),
    "quotation": (
        "Quotation",
        ["title", "quotation_number", "date", "recipient", "scope", "timeline", "team", "pricing", "terms"],
        "Susun surat quotation formal berisi nomor/hal/lampiran, penerima, introduction, Ruang Lingkup Pekerjaan, Ruang Lingkup Fitur, Arsitektur Sistem, Kerangka Pengembangan, Deliverables dan Kriteria Penerimaan, Out of Scope, Tim Kerja/Waktu/Biaya, termin pembayaran, catatan penting, timeline lampiran, dan Signature. Jangan menghitung nilai yang tidak diberikan.",  # noqa: E501
    ),
    "cost_projection": (
        "Cost Projection",
        ["title", "period", "rates", "workload", "exchange_rate", "scenarios"],
        "Susun Usage Cost Projection bertabel: Cost Inputs (kurs, rate STT/model, sumber dan tanggal verifikasi), asumsi workload dan token, Cost Projection per mode/durasi dalam USD/IDR, skenario bulanan, Insight Summary, Key Metrics, perbandingan provider/fallback bila tersedia, serta Catatan & Rekomendasi. Tampilkan rumus/asumsi dan jangan mengarang tarif.",  # noqa: E501
    ),
    "presentation": (
        "Presentation",
        ["title", "audience", "objective", "key_points", "call_to_action"],
        "Susun outline presentasi per slide dengan judul, objective, background, pesan utama, bukti/angka dari konteks, rekomendasi, next steps, dan call to action; satu pesan utama per slide dan speaker notes bila tersedia.",  # noqa: E501
    ),
    "uat": (
        "User Acceptance Test",
        ["title", "project", "client", "document_number", "version", "test_period", "changes", "test_cases"],
        "Susun dokumen UAT dengan cover dan metadata App Version, Branch, Date, Prepared By, Client, Project, Document Number, Version, dan Test Period; Changes Being Tested berkolom #/Change/Description; kelompokkan test case per modul dalam tabel #/Test Case/Steps/Expected Result/Status/Notes; tutup dengan ringkasan hasil, outstanding items, dan approval.",  # noqa: E501
    ),
    "bast": (
        "BAST",
        ["title", "document_number", "date", "parties", "project", "scope", "deliverables", "progress", "uat"],
        "Susun BAST formal dengan cover nomor/tanggal/para pihak, Pendahuluan, Identitas Para Pihak, Informasi Proyek, Ruang Lingkup Proyek, Metrik Keberhasilan & KPI, Out of Scope, Deliverables/Progress dan hasil Testing/UAT, Pernyataan Serah Terima, Penutup, blok tanda tangan kedua pihak, serta Lampiran daftar dokumen yang diserahkan. Jangan mengarang identitas, nilai proyek, tanggal, atau persetujuan.",  # noqa: E501
    ),
    "timeline": (
        "Project Timeline",
        ["title", "project", "start_date", "end_date", "phases", "week_count"],
        "Susun Gantt timeline yang dikelompokkan per phase dengan kolom No, Scope of Work, bucket Week/Month, dan Progress; tampilkan milestone, dependency, tanggal mulai/akhir, dan status bila tersedia.",  # noqa: E501
    ),
    "bug_report": (
        "Bug Report",
        ["title", "client", "project", "reported_at", "environment", "app_version", "bugs"],
        "Susun Bug Tracker dengan satu baris per bug dan dua kelompok kolom: Client Section berkolom Date Reported/What's Happening?/Steps to See the Issue/Environment or Device/App Version/How Urgent Is It?/Current Status; Developer Section berkolom Backend Version/Assigned Dev/Dev Notes or Resolution/Progress/Target Fix Date. Pertahankan keterkaitan tiap bug dan jangan mengarang hasil investigasi, assignee, status, atau target.",  # noqa: E501
    ),
}
