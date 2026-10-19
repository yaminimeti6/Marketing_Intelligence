# AI Assistant

Validation: production build and TypeScript passed; all 91 unit/database tests passed. Authenticated browser verified task/language selection, no page errors and no page overflow at 375/768/1440 pixels. Provider transport was tested with mocked responses; no paid provider call was sent during verification. Actual project API billing, model access and end-to-end generation remain unverified.

`/ai` supports report questions (Co-Pilot) and three ad-copy draft variants (Copywriter), in English, Gujarati and Hindi. Owners and admins can submit. No campaigns are published and no budgets changed.

Configure `OPENAI_API_KEY` privately in local `.env` and Netlify's production Functions environment. Optional `OPENAI_MODEL` defaults to `gpt-4.1-mini`. Redeploy after changing hosted configuration. Never use `NEXT_PUBLIC_` for the key. ChatGPT subscription billing does not cover API usage.

The server calls the fixed OpenAI Responses endpoint with `store:false`, a 25-second timeout, no tools, no retries and at most 1,000 output tokens. Disabling response storage does not promise zero provider retention; consult OpenAI data controls. Incomplete responses are not shown as complete answers. Authentication/model/quota/network failures have sanitized messages.

Each workspace gets ten attempted provider calls per rolling hour, including failed calls. PostgreSQL advisory locking and tenant-scoped audit rows make the limiter work across server instances. This is a request cap, not a dollar spending cap. Configure provider billing limits separately. Audit stores only `ai.requested`, actor and timestamp; prompts and responses are not persisted in the application.

Co-Pilot sends the question plus aggregate Meta metrics for the default last-30-day scope. Scope currency/timezone, exact dates, oldest account sync timestamp and coverage accompany the metrics. Missing coverage yields null metrics. No customer records, account names, provider IDs, credentials or raw ad entities are included. Copywriter sends only the brief/language. User-entered personal information cannot be automatically guaranteed absent; the form asks users not to include it.

Results are model-generated drafts; review claims and figures. Prompt instructions prohibit invented financial data, clinical/weight-loss guarantees, fake offers and claims of actions performed. This is not a factual-output guarantee. Shopify analysis, image/video generation, persistent chat history and campaign execution are not part of this increment.

References: [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses), [model](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
