# Free hosting: Render and Neon

Hosting is now authorized, free plans only. The repository includes `render.yaml` for one Free Node web service and `npm run start:hosted`, which binds Render's assigned `PORT` on `0.0.0.0`. Node 24 is required. No paid workers, paid databases or custom-domain purchases are included.

## Current prerequisite

Both current database URLs point to the local PC. Render cannot use them. Prepare a Neon cloud database before deploying the web service; never copy a localhost URL into Render.

Use a migration/admin connection to create the restricted `northstar_app` role, then run the existing versioned migrations against the intended cloud database. For a fresh database, bootstrap its Owner/workspace once. For preserving current accounts and imports, perform an intentional database migration instead of creating duplicate users; moving just schema does not move records. Keep local `.env` unchanged and cloud credentials separate while preparing this.

Render's `DATABASE_URL` must use the restricted runtime role, not the Neon owner/admin role. `/api/health` rejects superuser/RLS-bypass roles and missing migrations. Keep the migration credential and bootstrap password out of the web-service environment. Reuse the existing token encryption key and key ID if moving encrypted integration records; a different key cannot decrypt them.

## Create the service

Connect the Render and Neon accounts to continue account setup here, or use Render Dashboard → New → Blueprint with `yaminimeti6/Marketing_Intelligence`. Inspect the service plan: Free. The Blueprint asks for server-only database/encryption settings and the final HTTPS app origin. No `.env` files are uploaded from GitHub.

If using New Web Service instead: Node runtime, branch `main`, build command `npm ci --include=dev && npm run build`, start command `npm run start:hosted`, health path `/api/health`, Free instance. Node 24 is declared in package.json.

After Render assigns its actual URL, set both `APP_URL` and `APP_ORIGIN` to that HTTPS origin. Update Meta and Shopify registered callbacks and their corresponding server environment variables to the hosted origin before connecting. Copy remaining provider settings privately from local configuration only when required; do not paste secrets into chat. Set `MER_CHANNELS=meta`.

Update the Shopify custom pixel endpoint to the hosted `/api/shopify/events` only after confirming ingestion configuration in the cloud database. Local callbacks/pixels continue targeting the old local environment until intentionally changed.

## Sync and availability

`HOSTED_WORKERS=false` is the default. Existing imports do not automatically transfer from the local database. A worker must target the cloud database to process queued imports.

Once the cloud Owner/Admin worker IDs and provider credentials are configured, `HOSTED_WORKERS=true` starts the existing Meta, Shopify and rules runner beside the web server. This uses the same service's memory and works only while the service is awake; free-plan resource limits can cause restarts. Alternatively run workers locally against the cloud database. Do not point a cloud worker at local database IDs from an unrelated fresh cloud workspace.

Render Free services sleep after 15 minutes without inbound traffic and can take time to wake up. Pixel delivery, webhooks and background checks may be delayed or lost during downtime; there is no continuous-sync promise. Do not configure artificial traffic to evade free-tier limits. Neon Free also has its own usage limits. No paid services are activated by these files.

## Completion checks

Confirm the actual Render URL, successful deploy, `/api/health` response, Owner sign-in, workspace isolation and live provider reconnect/imports. Check the pixel endpoint and external callback registrations separately. A local build or committed Blueprint is not a live deployment.

References: [Render Next.js deployment](https://render.com/docs/deploy-nextjs-app), [Free limitations](https://render.com/docs/free), [Blueprint configuration](https://render.com/docs/blueprint-spec).
