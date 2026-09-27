# Preserved auth-entry prerequisites

The deployed `authentication/views/app/check.py` endpoint intentionally reveals
whether an email exists and selects MAGIC_CODE for users without an explicit
password when mail and magic are configured; new users similarly prefer magic.
The native `identity.entry.check` owns normalized email, existing, method and
canSignUp. Method is nullable when no email method is enabled. Disabled password
with enabled magic selects magic rather than offering an unusable credential
form. OAuth remains the existing independent availability owner.

`ENABLE_SIGNUP` uses inherited runtime adapter default `1`; legacy instance public
configuration used a conflicting default `0`. Native availability and actual
new-user creation use the same policy. The canonical authentication callback
checks it before user insertion across password, magic and OAuth. Existing users
can continue signing in. A current pending unexpired workspace invitation from a
currently authorized issuer is an exception. This intentionally tightens legacy
acceptance of any historical WorkspaceMemberInvite. Project-only invitations do
not create an exception. Lookup is bounded at 100 matching pending invitations;
overflow errors instead of producing a false answer. The issuer predicate is the
existing invitation authority owner, including account restriction and deleted
workspace checks.

The source's `IS_SELF_MANAGED = True` is reflected as isSelfManaged in public mail
availability; it is deployment identity, not an inferred account flag. Existing
password.capabilities and set/change actions remain the password onboarding owner.

The inherited email-check anonymous IP limiter is not implemented by a browser-
supplied IP or per-address counter. Trusted ingress limiting remains an explicit
public rollout gap. Native instance authority initialization is also separate
from legacy Instance.is_setup_done; existing native registration is not disabled
merely because operator authority bootstrap has not run. No env setting, live
email, backend deployment or production route cutover occurred in this slice.

Behavioral tests exercise normalized discovery, actual provider policy, truthful
null method, invitation expiry/issuer restriction, and installed Password signup
rejection while an existing account still signs in. Related identity/invitation
regressions preserve current issuer errors and auth/session owners.

Identity/invitation regression suite: 92 tests passed, followed by two additional
installed magic/OAuth signup rejection tests (16 mail/OAuth tests passed). Native
TS7 and touched Oxc passed.

## Password setup during onboarding

The installed canonical guarded create/modify credential owner retains the exact
initiating session and its refresh tokens while revoking other sessions. Email
change and account unlink separately revoke all sessions; those consequences must
not be applied to password setup. The preserved profile step may therefore set a
password and then complete the profile using its captured revision. Password setup
does not modify profile revision. New end-to-end owner tests cover both magic and
OAuth identities through set-password, profile completion, workspace selection and
real destination resolution, including current-session retention and other-session
revocation.

Password capabilities and both actions now obey canonical operator Password
availability. A disabled provider offers neither set nor change and rejects before
credential mutation; it does not silently advertise an action against an
unregistered provider. Ten focused password tests and native TS7 passed. No real
credentials, sessions or deployed configuration were changed.
