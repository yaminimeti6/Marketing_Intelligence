# Growth workspace and layout refresh

The workspace uses a grouped, searchable sidebar, compact KPI cards, filter panels and responsive tables. Public references reviewed: [FabFunnel](https://fabfunnel.com/), [Madgicx](https://madgicx.com/), [Triple Whale navigation guide](https://kb.triplewhale.com/en/articles/12117524-a-guide-to-triple-whale-s-navigation), and [Northbeam](https://www.northbeam.io/). This is an original implementation informed by public references; authenticated vendor applications were not inspected.

## Available tools

- `/attribution` and `/revenue-attribution`: observed first-touch, last-touch and linear revenue allocation over a 30-day window. Exact monetary allocation conserves totals; missing order values remain unknown. Unmatched purchases stay unattributed. Cohorts show retained observed customer revenue and repeat purchases, not predictive or full-history LTV, causal lift, or verified event-date Shopify Net Sales. Fresh complete Shopify imports and consented journey events are required.
- `/funnels`: private plain-text landing-page drafts, preview and explicit publish/unpublish at `/f/[key]`. Editing removes publication. Only headline, body and HTTPS CTA destination are published. No drag-and-drop store editor or hosted-funnel conversion tracking is provided.
- `/research`: official Meta Ad Library searches and private competitor bookmarks/notes. No automated competitor dataset, scraping or competitor ROAS claims.
- `/video-sage`: local video frame sampling and optional OpenAI visual review. Four sampled still images do not establish audio, transcript or full-motion analysis. API credits and model access are required. Generative video remains unconfigured.
- `/launcher`: Traffic or Sales/Purchase campaign, one ad set and up to three library image ads. Builds paused objects first; publication requires separate review and confirmation. Requires advertising-write opt-in, ads_management, appropriate Page/pixel access and valid account settings. Failed or uncertain provider writes require manual reconciliation; no blind retry or rollback. This is not an arbitrary-objective, multi-account or video/carousel bulk launcher.
- `/capi`: opt-in Meta Purchase delivery using imported original order value and consented fbp/fbc identifiers. No names, email, IP or user-agent are collected by this flow. Settings are disabled by default and credentials/matching identifiers are encrypted.

## CAPI setup and limits

Configure the intended Meta dataset and token in the owner/admin screen. Run `npm run capi:pixel` to prepare the private Shopify snippet, then install it manually and validate both analytics and marketing consent. Existing measurement setup is a prerequisite. Run `npm run worker:capi` with the same restricted cloud database and encryption configuration as the Shopify worker; the worker watcher also includes it.

Confirm Purchase deduplication before enabling: another sender must use the same event ID or be disabled. The app cannot prove external sender configuration. The worker checks a recent Shopify import and a paid original order before sending. Network/ambiguous responses become uncertain and are not automatically resent. Pending receipts expire after 24 hours. Consent withdrawal does not currently notify the server to cancel an already queued receipt. Browser receipts are not cryptographic purchase proof; server order checks limit their use. Match quality and actual Meta event receipt require live acceptance testing.

## Validation and deployment

134 unit/database tests, typecheck and production build passed. Browser checks covered eight feature routes and widths 375, 768 and 1440 pixels, including mobile navigation and page search. Migrations 024-026 were applied to local and Neon databases. Narrow public database functions return only published content or validated enabled-source routing; runtime roles remain tenant restricted.

No campaign was launched, paid AI request made, CAPI event sent, email delivered or funnel publicly published during verification. Deploy the new commit to expose the layout and routes on Netlify. Persistent imports and deliveries require the external workers; request hosting alone does not run them.
