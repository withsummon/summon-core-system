# Automation UI review

## Experience selection

This flow helps a workspace member choose document instructions, inspect generated
content privately, and deliberately share the result with a named project.

Inspected Mobbin references:

- [Employment Hero template selection](https://mobbin.com/screens/305a845d-734e-424b-b902-463cd90dfc8a): compact text rows emphasize the template name and its type. Adopted for text-oriented templates.
- [Manus template gallery](https://mobbin.com/screens/3b3b64a8-5449-4948-a352-a044cec3c9d3): image tiles distinguish visual themes. Rejected here because these templates contain instructions, without distinct visual designs.
- [Ghost publication result](https://mobbin.com/screens/f444efff-1523-4b9d-a931-e663c9d051c1): clear completion state and return destination. Adapted as Published plus Open document.
- [Coda publication result](https://mobbin.com/screens/cda8a8d5-d372-4740-a120-cbdd8a0522ab): audience implications and destination alongside publication controls. Adapted as a named project, explicit sharing consequence, and approval checkbox.

| Baseline / gap                                   | Decision                                                      | Visible acceptance                                            |
| ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------- |
| No native automation screen                      | Separate templates from persisted personal previews           | Template actions and past jobs have distinct sections         |
| Publication expands a private preview's audience | Show project name and sharing consequence beside approval     | No publish button enabled before deliberate approval          |
| Provider may be absent                           | Render persisted failure and recovery instruction             | No synthetic preview or success message                       |
| Source selection already exists in assistant     | Export its ContextFields; suppress duplicate project selector | One destination selector and shared paginated source controls |

## Evidence

Local Chrome on 2026-09-27 exercised explicit default installation (13 templates),
custom template creation, destination selection, generation with absent provider,
and persisted failure after reload. Failure job:
`http://127.0.0.1:3010/core?workspace=northstar-convex-qa&module=automation&automationJob=q17e5rgsnv446zxacg0cyzv2b18f6x3s`.

Inspected desktop 1728px and narrow 390px layouts. The title/status wrap, destination,
and recovery message remain readable; narrow content scrolls without observed
horizontal overflow. The existing mobile shell consumes considerable vertical
space before the module content. Temporary viewport override was reset.

Generated-preview and publication browser states remain unverified because no
provider key is configured. The backend suite separately verifies mocked provider
transport, actual canonical editor conversion, explicit publication, same-document
idempotency, and rollback. Tests are not a claim of visual publication acceptance.

Primary readback after the 07:07:41 local deployment repeated generation using the current template revision and a named destination. The new job persisted a provider-unconfigured failure, displayed no invented preview, and exposed no publication action. The backend suite passed 206 tests in aggregate, including nine automation scenarios.
