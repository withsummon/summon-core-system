# Summon Core Gap Closure Execution Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved Summon Core PDF gap-closure design as five reviewable, independently testable plans.

**Architecture:** Extend Plane in place. Complete runtime and shared UI first, then Plane-backed surfaces, Summon business workflows, provider-agnostic AI, and finally reporting plus release acceptance.

**Tech Stack:** Django 5, Django REST Framework, PostgreSQL, React 19, React Router 7, TypeScript, MobX, SWR, Tailwind CSS 4, Plane UI/Propel, OpenAI Python client, Requests, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-summon-core-pdf-gap-closure-design.md`

## Global Constraints

- Native Plane Projects, work items, Pages, FileAssets, Inbox, notifications, settings, authentication, and Power-K remain reachable and canonical.
- LLM configuration is instance-level; ordinary workspace requests never accept provider credentials or base-URL overrides.
- Supported protocols are `openai`, `openai_compatible`, `anthropic`, and `gemini`; the model identifier is administrator-supplied.
- Add no frontend chart library or vendor AI SDK; reuse CSS, native SVG, the installed OpenAI client, and `requests`.
- Add only the approved `AssistantConversation` and `AssistantMessage` Summon models.
- No production mock records, copied Plane records, silent autonomous writes, automatic speech-to-text, vector database, or RAG infrastructure.
- Desktop visual acceptance uses 1440 by 900 with the Plane sidebar expanded; mobile acceptance uses 390 by 844.
- Every create, update, generate, and publish flow requires reload/read-back proof and zero browser-console errors.

## Execution Order

1. [Runtime, shell, navigation, and sign-in](2026-08-22-summon-runtime-shell-and-sign-in.md)
2. [Home, Project Overview, and Plane-backed surfaces](2026-08-22-summon-plane-backed-surfaces.md)
3. [Commercial and operational workflows](2026-08-22-summon-commercial-operations.md)
4. [Instance LLM and AI workflows](2026-08-22-summon-instance-llm-ai.md)
5. [Reporting and release hardening](2026-08-22-summon-reporting-release.md)

Do not begin a later plan until the preceding plan's tests, build, browser flow, and scoped diff review pass. Each plan ends with a separate commit so a reviewer can accept or reject that subsystem without mixing unrelated changes.

## PDF Coverage Ledger

| Screen                               | Owning plan   |
| ------------------------------------ | ------------- |
| Sign-in                              | Plan 1        |
| Project summary and Project Overview | Plan 2        |
| Knowledge                            | Plan 2        |
| Management & Reporting               | Plan 5        |
| Client profile                       | Plan 3        |
| Credential Vault                     | Plan 3        |
| Power-K command palette              | Plan 3        |
| Settings                             | Plans 3 and 4 |
| Opportunities                        | Plan 3        |
| Home command center                  | Plan 2        |
| Resources                            | Plan 2        |
| Automation Studio                    | Plan 4        |
| Summon Assistant                     | Plan 4        |
| Task Center                          | Plan 2        |
| Meeting Workspace                    | Plans 3 and 4 |
| Notifications                        | Plan 2        |
| Documents navigation surface         | Plan 2        |
