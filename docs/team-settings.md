# Team invitations, roles and workspace settings

Update 17 October: Analyst roles/invitations, hydration fixes, integration audit history and Owner-confirmed browser-event retention are implemented. See [current reporting update](reporting-update.md). The following records the original increment; its three-role inventory is historical.

Implemented October 16, 2026. `/settings` now has real profile/security, workspace preferences, workspace switching, member roles, invitation management and team activity. No external email provider was configured or used.

## Permissions and safeguards

- Owner: workspace preferences; invite Admin/Viewer; promote/demote/remove members. An Owner invitation is not issued directly; an existing member can be promoted with explicit confirmation.
- Admin: provider management remains available; invite Viewer and revoke own pending Viewer invitations. Admins cannot grant Admin/Owner, change member roles, remove members or alter workspace preferences.
- Viewer: own profile, own membership, reports and personal saved reports. Other members' email addresses, invitations and team activity are not returned to Viewers.
- Every team management mutation revalidates the actual database session and current membership. Workspace-row locks serialize changes and protect the last Owner against removal/demotion. Role changes/removal invalidate affected workspace sessions. Member removal also revokes outstanding invitations for that email. Acceptance rechecks the issuer's current authority.
- Switching requires an existing membership, creates a fresh workspace-bound session and invalidates the old browser session. Login's original default workspace selection is preserved; use Settings to choose another authorized workspace.

## Invitations
  
The application creates a cryptographically random 256-bit token, stores only its SHA-256 hash and shows the raw private link once to the inviter. The link targets a specific email and Admin/Viewer role, expires after 72 hours and is single-use. Reissuing invalidates old pending links. Owners can revoke pending links. Ten creations per issuer/workspace per hour and 100 active invitations per workspace are enforced.

Delivery is manual: Create invitation link ? Copy ? share privately with the intended recipient. The application explicitly says created, not emailed. No mail was sent to anyone, and no delivery success is fabricated.

The token is in the URL fragment (`/invite#...`), which is not sent in HTTP requests. The public invitation UI removes the fragment from the address bar immediately, retains it only in component memory and posts it to a server action when accepted. Do not share invitation links in screenshots/logs. Reopen the original complete link if refreshing before accepting. The invitation page sets no-referrer and private/no-store headers.

New invitees choose their name and a 12�256 character password; existing users prove their current password or use a matching authenticated session. A mismatched signed-in account is rejected. Acceptance never resets an existing password or changes an already-established membership role. Password attempts are bounded to ten per 15-minute window. Successful acceptance joins the correct workspace and rotates the browser session. No public workspace signup or email password-reset flow is enabled.

## Profile and preferences

Profile name can be updated; email is read-only. Password changes require the current password and matching new password; all other sessions across workspaces are invalidated. Update private password storage after a real password change. Editing a local credentials file does not change the database password. No existing Owner password was changed by implementation/testing.

Workspace name and optional preferred currency/timezone are Owner-only and require confirmation. These preferences do not convert currency, merge reporting scopes or recalculate historical/source facts. Current reports continue to use provider account currency and timezone.

## Database boundary

Migration 007 adds preference columns plus private team_invitations/team_events. Runtime retains no raw mutation grants on users/memberships/workspaces and no raw grants on invitation/event tables. Parameterized SECURITY DEFINER functions use a fixed search_path, explicit session/workspace/current-role or invitation-capability checks and fixed SQL; default PUBLIC execute privileges are revoked.

Invitation/event tables have RLS enabled with no runtime policies or table grants. They deliberately do not FORCE RLS on the function-owning migration role: capability-based acceptance must work before the invitee has workspace membership. Only the guarded functions access these private authentication tables, analogous to existing private authentication infrastructure. Existing reporting/provider forced-RLS policies remain unchanged. This exception is explicit; do not grant runtime direct access to these tables.

Recent team events record invitation creation/revocation/acceptance, member role changes/removal, workspace/profile changes and password-change events. Tokens, hashes and passwords are never included in DTOs or event details. Billing, SMTP delivery, notification settings, account email changes, password reset and MFA remain unimplemented.

## Verification

Isolated tests cover field validation, unknown-error redaction, Owner/Admin/Viewer boundaries, cross-workspace denial, last Owner protection, raw-table grant denial, session-bound management, single-use/revoked/expired/reissued invitations, existing-password integrity, session invalidation and workspace switching. Production build and TypeScript passed. Native migration applied without reset. Browser verification results are appended after completion.

Verification completed: all 41 unit/database tests, all 11 production browser checks and production build/TypeScript passed. Browser checks created and revoked an example.invalid invitation without sending email, confirmed last-Owner controls are disabled, stripped the fragment and rejected the revoked link; existing reports/integrations and responsive widths still pass. Verification invitation records remain revoked in the activity trail; no live team member was added and no Owner password/profile was changed. New-account acceptance, existing-password preservation, role/session changes and workspace switching were exercised against isolated test data.

Manual invitation links support administrator-provisioned account identifiers; accepting a link does not independently verify mailbox ownership. Verified delivery/identity onboarding is a separate requirement before opening a public multi-tenant signup service. This local admin-managed flow does not claim that email verification, SMTP, MFA or password reset is configured.
