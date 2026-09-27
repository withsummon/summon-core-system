# Project navigation identity correction

The project shell gave sibling LeaveMembership and ProjectBoundary the same
project ID key. React reconciliation could duplicate the Leave project control
when switching projects. The shell owns sibling identity; the leave control now
uses a distinct leave-prefixed key while retaining project-scoped remounting.
No wrapper, fallback or compatibility path was added.

Chrome reload and NSTAR → QADEL → NSTAR navigation each showed one Leave project
control. Captured duplicate-key warnings predated the corrected navigation; no
new warning appeared. Global checkpoint tests (571 backend,40 live,50 frontend)
and30 typecheck tasks passed; scoped Oxc passed. This is local dev acceptance.
