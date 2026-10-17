CREATE TABLE meta_oauth_states (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  state_hash text NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash text NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,state_hash)
);
CREATE TABLE meta_ad_accounts (
  workspace_id uuid NOT NULL, connection_id uuid NOT NULL, account_id text NOT NULL,
  name text NOT NULL, currency text, timezone_name text, account_status integer,
  selected boolean NOT NULL DEFAULT false, accessible boolean NOT NULL DEFAULT true,
  discovered_at timestamptz NOT NULL DEFAULT now(), last_synced_at timestamptz,
  PRIMARY KEY(workspace_id,connection_id,account_id),
  FOREIGN KEY(workspace_id,connection_id) REFERENCES provider_connections(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE meta_entities (
  workspace_id uuid NOT NULL, connection_id uuid NOT NULL, account_id text NOT NULL,
  entity_id text NOT NULL, level text NOT NULL CHECK(level IN ('campaigns','adsets','ads')),
  name text NOT NULL, campaign_id text, adset_id text, status text, effective_status text,
  daily_budget numeric(24,0), lifetime_budget numeric(24,0), synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,connection_id,account_id,level,entity_id),
  FOREIGN KEY(workspace_id,connection_id,account_id) REFERENCES meta_ad_accounts(workspace_id,connection_id,account_id) ON DELETE CASCADE
);
-- Source Insights snapshots preserve strings/action types and provider settings.
-- Reporting and metric aggregation belong to the following dashboard milestone.
CREATE TABLE meta_insight_facts (
  workspace_id uuid NOT NULL, connection_id uuid NOT NULL, account_id text NOT NULL,
  level text NOT NULL CHECK(level IN ('campaign','adset','ad')), entity_id text NOT NULL,
  date_start date NOT NULL, date_stop date NOT NULL, attribution_settings text NOT NULL DEFAULT 'account',
  currency text, timezone_name text, api_version text NOT NULL,
  source jsonb NOT NULL, synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,connection_id,account_id,level,entity_id,date_start,date_stop,attribution_settings),
  FOREIGN KEY(workspace_id,connection_id,account_id) REFERENCES meta_ad_accounts(workspace_id,connection_id,account_id) ON DELETE CASCADE,
  CHECK(date_stop>=date_start)
);
ALTER TABLE sync_jobs ADD COLUMN payload jsonb NOT NULL DEFAULT '{}';
ALTER TABLE sync_jobs ADD COLUMN lease_token uuid;
ALTER TABLE sync_jobs ADD COLUMN finished_at timestamptz;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['meta_oauth_states','meta_ad_accounts','meta_entities','meta_insight_facts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT USING (workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid))',t,t);
    EXECUTE format('CREATE POLICY tenant_write ON %I FOR ALL USING (workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin''))) WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin'')))',t,t,t);
  END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON meta_oauth_states,meta_ad_accounts,meta_entities,meta_insight_facts TO northstar_app;
