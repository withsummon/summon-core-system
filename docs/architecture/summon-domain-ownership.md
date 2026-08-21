# Summon Domain Ownership

Each capability has one canonical owner. `plane.summon` extensions reference Plane records rather than duplicating them.

| Capability                                                                           | Canonical owner | Boundary                                                            |
| ------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------- |
| Login, sessions, password reset, OAuth, and request access                           | Plane           | Plane authentication and User                                       |
| Workspace, members, roles, preferences, and settings                                 | Plane           | Workspace, WorkspaceMember, project membership, and settings        |
| Projects and project members                                                         | Plane           | Project and ProjectMember                                           |
| Project-specific client, opportunity, delivery, phase, health, date, and budget data | plane.summon    | SummonProjectProfile only                                           |
| Work items, assignees, state, priority, dates, and views                             | Plane           | Issue/work item, State, IssueAssignee, and views                    |
| Milestones, timelines, and progress                                                  | Plane           | Module, Cycle, and work-item analytics                              |
| Knowledge, notes, guides, FAQ, lessons learned, and templates                        | Plane           | Page and labels                                                     |
| Page-to-client or opportunity context                                                | plane.summon    | SummonPageContext only                                              |
| Documents and uploaded files                                                         | Plane           | FileAsset, page assets, and issue attachments                       |
| Notifications and notification preferences                                           | Plane           | Notification and UserNotificationPreference                         |
| Project and work-item activity                                                       | Plane           | Activity and version models                                         |
| Clients, contacts, opportunities, and pipeline                                       | plane.summon    | Workspace-scoped commercial records                                 |
| Meetings and participants                                                            | plane.summon    | Meeting and MeetingParticipant; action items reference Plane Issues |
| External resource URLs and display metadata                                          | plane.summon    | ResourceLink only; files remain Plane FileAssets                    |
| Automation templates, jobs, and generated-artifact metadata                          | plane.summon    | Outputs reference Plane Pages or FileAssets                         |
| Credential vault, grants, and immutable access audit                                 | plane.summon    | Workspace/project-scoped credential records using Plane Users       |
| Reports                                                                              | Plane           | Computed from canonical Plane and Summon data; no summary table     |
| Summon assistant                                                                     | plane.summon    | Deterministic Django service over authorized canonical data         |
| Command palette                                                                      | Plane           | Power-K store and command UI                                        |

## `plane.summon` model allowlist

| Model                | Owner        |
| -------------------- | ------------ |
| Client               | plane.summon |
| ClientContact        | plane.summon |
| Opportunity          | plane.summon |
| SummonProjectProfile | plane.summon |
| Meeting              | plane.summon |
| MeetingParticipant   | plane.summon |
| MeetingWorkItem      | plane.summon |
| SummonPageContext    | plane.summon |
| ResourceLink         | plane.summon |
| AutomationTemplate   | plane.summon |
| AutomationJob        | plane.summon |
| GeneratedArtifact    | plane.summon |
| Credential           | plane.summon |
| CredentialGrant      | plane.summon |
| CredentialAccessLog  | plane.summon |
