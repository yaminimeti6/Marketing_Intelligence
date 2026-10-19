# Campaign Actions

`/ad-manager` supports reviewed advertising mutations for owners/admins. This increment supports:

- Creating **one paused campaign container**, without ad sets, targeting, creatives, ads or a budget. Traffic, Sales and Awareness objectives are allowed. The owner must confirm the campaign is not in a Special Ad Category; special-category creation is unsupported.
- ACTIVE/PAUSED configured-status changes on up to five imported campaigns/ad sets/ads in one accessible account.
- Replacing daily budgets on up to five campaigns/ad sets with an existing daily budget and no lifetime budget. INR/USD/EUR/GBP are supported with exact two-decimal-to-minor-unit conversion. The application maximum is 1,000,000 currency units per selected object/day; Meta may impose other minimums/limits.

This is **not** a complete new-ad launch wizard. Creating new targeting, ad sets, image/video creatives, page/Instagram identities, conversion destinations, placements and ads remains pending. No such resources were created during implementation.

## Enabling execution

1. Register the live OAuth callback in the Meta app if it still points only to the old ngrok URL.
2. Use **Authorize Meta ad management**. Standard OAuth explicitly requests `ads_read,ads_management` only for this action; ordinary integration authorization remains `ads_read`. If `META_LOGIN_CONFIG_ID` is configured, update that Meta Login configuration to include ads_management before reconnecting. Requesting a permission does not prove it was granted; Meta app/access review and account permissions still apply.
3. Set server-only `META_AD_WRITES_ENABLED=true` in the appropriate runtime environment and redeploy/restart. The feature defaults **off**; this implementation did not enable it in local or live configuration.
4. Save a draft, then review its exact account, currency, object IDs, imported configured statuses, old daily budgets and requested change. Budget review includes the combined new daily budget across selected objects, separately from other account/parent budgets.
5. Within 15 minutes of draft creation, type `APPLY N CHANGES`, acknowledge the spend implications and confirm execution. Activating objects or changing budgets may cause advertising spend. A daily budget is not a guaranteed daily spend cap.

No provider mutation is sent when saving a draft. A paused container itself cannot deliver ads. Creating a paused container still changes the Meta account and therefore requires the same reviewed execution flow.

## Execution and recovery

Migrations add tenant-scoped operation and item journals. Owner/admin authorization, workspace membership, account access, current connection state, grant scopes and expiry are checked server-side. The actual token is debug-validated again before each item. Fresh Meta reads confirm account/currency/status and target ownership. Daily-budget writes also compare current daily/lifetime values against the draft snapshot. Stale snapshots fail and require a fresh draft.

Each request claims one pending item transactionally before contacting Meta. Workspace locking and account-wide unresolved-item checks prevent concurrent overlapping attempts. Completed items are never re-executed. An interrupted approved batch can be reviewed and continued while the original draft is still fresh; already completed items remain completed. Browser execution is bounded to five sequential item calls, each with provider timeouts.

Writes have **no automatic retry**. Network timeout, HTTP 5xx or an invalid success response after POST is marked uncertain. A process crash may leave an item running. Do not repeat such writes: inspect Meta Ads Manager, reconcile the resulting resource/status/budget, then have an authorized operator resolve the journal before another draft for that account. There is no automated uncertain-result reconciler or manual-resolution UI yet. New drafts/execution are blocked while a running/uncertain item remains for that account. If an item fails or is uncertain, remaining pending items are marked not attempted. Prior successful changes remain in Meta; batches are not atomic and no automatic rollback occurs.

Meta object IDs are retained in the journal on acknowledged success; raw provider error bodies and tokens are not exposed. Audit rows record draft, approval and item outcome; journal records retain creator/approver, snapshots and timestamps. Provider success does not refresh imported analytics automatically: request a report sync and run the cloud worker to import the new state.

## Verification and limits

Production build/TypeScript passed; all 111 unit/database tests passed. Tests use mock provider transport for paused creation, fresh ownership/snapshot checks and ambiguous POST behavior; database fixtures verify tenant isolation and viewer mutation denial. Authenticated cloud preview verified the form, mobile layouts at 375/768/1440, disabled-write refusal and cross-origin refusal, with no page errors. No workspace drafts were seeded, no new Meta scopes were granted and **zero provider writes** were sent. Live API acceptance, account-specific restrictions and real resource creation remain unverified until the owner enables the feature and confirms a concrete operation.

References: [Meta's official Business SDK](https://github.com/facebook/facebook-nodejs-business-sdk), [official campaign fields/statuses/objectives](https://raw.githubusercontent.com/facebook/facebook-nodejs-business-sdk/main/src/objects/campaign.js), [Meta-maintained Marketing API collection](https://www.postman.com/meta/facebook-marketing-api/overview).
