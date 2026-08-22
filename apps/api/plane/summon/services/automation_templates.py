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
        "Susun proposal vendor dengan Disclaimer, Executive Summary, Objectives, Client Request Detail, Scope dan Out of Scope, Success Criteria dan Deliverables, Detailed Features, Architecture, Timeline, Resource Allocation, dan Notes. Jangan menambahkan bagian harga atau nilai komersial.",  # noqa: E501
    ),
    "proposal_client": (
        "Client Proposal",
        ["title", "client", "request", "scope", "timeline", "resources", "pricing"],
        "Susun proposal klien dengan Disclaimer, Executive Summary, Objectives, Client Request Detail, Scope dan Out of Scope, Success Criteria dan Deliverables, Detailed Features, Architecture, Timeline, Resource Allocation, Pricing Scheme, dan Notes.",  # noqa: E501
    ),
    "invoice": (
        "Invoice",
        ["title", "invoice_number", "issue_date", "due_date", "client", "items", "currency", "payment_details"],
        "Susun invoice Summon formal: nomor/tanggal/jatuh tempo, Bill From dan Bill To, tabel item Description/Qty/Unit Rate/Amount, Subtotal, Tax, Total dan Currency, payment/bank details, notes, serta signature; jangan menghitung nilai yang tidak diberikan.",  # noqa: E501
    ),
    "quotation": (
        "Quotation",
        ["title", "quotation_number", "date", "recipient", "scope", "timeline", "team", "pricing", "terms"],
        "Susun surat quotation formal berisi metadata surat, penerima, introduction, Scope, Deliverables, Timeline, Team, Pricing, Terms, Notes, dan Signature.",  # noqa: E501
    ),
    "cost_projection": (
        "Cost Projection",
        ["title", "period", "rates", "workload", "exchange_rate", "scenarios"],
        "Susun proyeksi biaya bertabel: input rates termasuk model/STT dan kurs, asumsi workload minutes serta input/output tokens, biaya per session dalam USD/IDR, lalu skenario bulanan beserta rumus dan total; jangan mengarang tarif.",  # noqa: E501
    ),
    "presentation": (
        "Presentation",
        ["title", "audience", "objective", "key_points", "call_to_action"],
        "Susun outline presentasi per slide dengan judul, objective, background, pesan utama, bukti/angka dari konteks, rekomendasi, next steps, dan call to action; satu pesan utama per slide dan speaker notes bila tersedia.",  # noqa: E501
    ),
    "uat": (
        "User Acceptance Test",
        ["title", "project", "client", "document_number", "version", "test_period", "changes", "test_cases"],
        "Susun dokumen UAT dengan cover metadata; Changes Being Tested berkolom #/Change/Description; kelompok test case bertabel #/Test Case/Steps/Expected Result/Status/Notes; tutup dengan ringkasan hasil, outstanding items, dan approval.",  # noqa: E501
    ),
    "bast": (
        "BAST",
        ["title", "document_number", "date", "parties", "project", "scope", "deliverables", "progress", "uat"],
        "Susun BAST formal berisi pembukaan, identitas para pihak, informasi proyek, Scope, Deliverables dan Progress, hasil Testing/UAT, pernyataan serah terima/penerimaan, catatan, serta blok tanda tangan kedua pihak.",  # noqa: E501
    ),
    "timeline": (
        "Project Timeline",
        ["title", "project", "start_date", "end_date", "phases", "week_count"],
        "Susun Gantt timeline yang dikelompokkan per phase dengan kolom No, Scope of Work, bucket Week/Month, dan Progress; tampilkan milestone, dependency, tanggal mulai/akhir, dan status bila tersedia.",  # noqa: E501
    ),
    "bug_report": (
        "Bug Report",
        ["title", "client", "project", "reported_at", "environment", "app_version", "bugs"],
        "Susun dua tabel: Client berkolom Date Reported/What's Happening?/Steps/Environment/App Version/Urgency/Status; Dev berkolom Backend Version/Assigned Dev/Dev Notes/Progress/Target Fix Date. Pertahankan keterkaitan tiap bug tanpa mengarang hasil investigasi.",  # noqa: E501
    ),
}
