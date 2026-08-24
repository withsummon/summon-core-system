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
        "Susun MoM IGLO dengan identitas Project, Client, Document No, Topic, Date, Time, Place, serta peserta atau pihak yang diwakili; tabel To Do terpisah per pihak berkolom No/Tugas/Keterangan; Discussion dikelompokkan per topik, Decisions, Open Items, Next Actions, dan Next Schedule. Owner dan due date hanya bila disepakati. Jangan mengubah pertanyaan, usulan, atau diskusi terbuka menjadi keputusan. Nyatakan arahan visual marun dan kuning IGLO.",  # noqa: E501
    ),
    "mom_summon": (
        "Minutes of Meeting - Summon",
        ["title", "project", "client", "document_number", "topic", "date", "time", "place", "parties"],
        "Susun MoM dengan corporate header Summon; identitas Project, Client, Document No, Topic, Date, Time, Place, serta peserta atau pihak yang diwakili; tabel To Do terpisah per pihak berkolom No/Tugas/Keterangan; Discussion dikelompokkan per topik, Decisions, Open Items, Next Actions, dan Next Schedule. Owner dan due date hanya bila disepakati. Jangan mengubah pertanyaan, usulan, atau diskusi terbuka menjadi keputusan.",  # noqa: E501
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
        "Susun surat quotation formal berisi nomor/tanggal/hal/lampiran, issuer dan recipient legal identity, introduction dan solution summary, tabel package atau scope dengan quantity/effort basis serta unit/total price, tax treatment, validity, payment terms dan payment instructions, schedule assumptions, exclusions, closing, dan authorized Signature. Hitung ulang subtotal/total hanya bila seluruh komponennya tersedia; jangan mengarang harga, pajak, diskon, rekening, masa berlaku, atau kewenangan penandatangan.",  # noqa: E501
    ),
    "cost_projection": (
        "Cost Projection",
        ["title", "period", "rates", "workload", "exchange_rate", "scenarios"],
        "Susun Usage Cost Projection dengan area terpisah berjudul Assumptions, Unit Pricing, Usage Detail, Monthly Projection, dan Summary/Insight Summary. Cantumkan unit, sumber serta tanggal efektif harga model/provider dan kurs, workload/token/durasi, lingkungan dan periode; tampilkan rumus usage x unit price, total komponen, dan konversi kurs secara auditabel. Tambahkan Key Metrics, skenario hanya bila diminta, serta Catatan & Rekomendasi. Jangan mengarang tarif, kurs, pajak, atau margin.",  # noqa: E501
    ),
    "presentation": (
        "Presentation",
        ["title", "audience", "objective", "key_points", "call_to_action"],
        "Susun outline presentasi per slide dengan judul, objective, background, pesan utama, bukti/angka dari konteks, rekomendasi, next steps, dan call to action; satu pesan utama per slide dan speaker notes bila tersedia.",  # noqa: E501
    ),
    "uat": (
        "User Acceptance Test",
        ["title", "project", "client", "document_number", "version", "test_period", "changes", "test_cases"],
        "Susun dokumen UAT dengan cover dan metadata App Version, Branch/Build, Date, Prepared By, Client, Project, Document Number, Version, Test Period, Environment, Prerequisites, dan Data Setup tanpa secrets; Changes Being Tested berkolom #/Change/Description; kelompokkan test case per modul dalam tabel ID/Role/Test Case/Steps/Expected Result/Actual Result/Status/Evidence/Tester/Date/Defect Link/Retest Result/Notes; tutup dengan status summary, open risks, outstanding items, acceptance decision, dan approval. Bedakan Not Tested, Passed, Failed, dan Blocked; jangan menandai Passed tanpa evidence actual result.",  # noqa: E501
    ),
    "bast": (
        "BAST",
        ["title", "document_number", "date", "parties", "project", "scope", "deliverables", "progress", "uat"],
        "Susun BAST formal dengan cover nomor/tanggal/tempat/para pihak, Pendahuluan, Identitas Para Pihak, dasar kontrak dan Informasi Proyek, Ruang Lingkup yang benar-benar selesai, Metrik Keberhasilan/KPI bila tersedia, Deliverables beserta evidence, hasil Testing/UAT dan deployment evidence, known exceptions serta follow-up obligations, warranty/support hanya bila disepakati, Pernyataan Serah Terima dan Penerimaan, Penutup, blok tanda tangan kedua pihak, serta Lampiran daftar dokumen yang diserahkan. Jangan mengarang identitas, completion, deployment, defect-free claim, pembayaran, tanggal, persetujuan, atau kewenangan signatory.",  # noqa: E501
    ),
    "timeline": (
        "Project Timeline",
        ["title", "project", "start_date", "end_date", "phases", "week_count"],
        "Susun Gantt timeline yang dikelompokkan per phase dengan kolom No, Scope of Work, Start, End, Duration, Dependencies, bucket Week/Month, Milestone, Owner, dan Progress/Status; gunakan weekly atau monthly columns sesuai durasi. Hanya tampilkan discovery/design, build, testing/UAT, deployment, dan stabilization bila benar-benar ada di rencana. Pastikan tanggal task berada dalam phase bounds dan dependency tidak dimulai sebelum prerequisite selesai.",  # noqa: E501
    ),
    "bug_report": (
        "Bug Report",
        ["title", "client", "project", "reported_at", "environment", "app_version", "bugs"],
        "Susun Bug Tracker dengan satu baris per bug dan dua kelompok kolom. Client Section: Date Reported, What's Happening?, Steps to See the Issue, Expected Result, Actual Result, Environment or Device, App/Build Version, Severity, Current Status, Evidence Link, dan Client Verification. Developer Section: Issue ID, Backend Version, Assigned Developer, Resolution or Root Cause, Progress, Target Fix Date, Deployment Reference, dan Retest Result. Pertahankan keterkaitan tiap bug dan jangan mengarang hasil investigasi, assignee, status, target, deployment, atau verifikasi.",  # noqa: E501
    ),
}
