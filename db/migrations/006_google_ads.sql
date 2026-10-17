ALTER TABLE provider_connections DROP CONSTRAINT provider_connections_provider_check;
ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_provider_check CHECK(provider IN('meta','shopify','google_ads'));
ALTER TABLE sync_jobs DROP CONSTRAINT sync_jobs_provider_check;
ALTER TABLE sync_jobs ADD CONSTRAINT sync_jobs_provider_check CHECK(provider IN('meta','shopify','google_ads'));
CREATE TABLE google_ads_oauth_states (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,state_hash text NOT NULL,
 user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,session_hash text NOT NULL,
 verifier_envelope text NOT NULL,key_id text NOT NULL,expires_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,state_hash)
);
CREATE TABLE google_ads_accounts (
 workspace_id uuid NOT NULL,connection_id uuid NOT NULL,customer_id text NOT NULL CHECK(customer_id~'^[0-9]{10}$'),
 name text NOT NULL,currency text NOT NULL,timezone_name text NOT NULL,manager boolean NOT NULL,status text NOT NULL,
 login_customer_id text,selected boolean NOT NULL DEFAULT false,accessible boolean NOT NULL DEFAULT true,
 discovered_at timestamptz NOT NULL DEFAULT now(),last_synced_at timestamptz,
 PRIMARY KEY(workspace_id,connection_id,customer_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES provider_connections(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE google_ads_entities (
 workspace_id uuid NOT NULL,connection_id uuid NOT NULL,customer_id text NOT NULL,
 level text NOT NULL CHECK(level IN('campaign','ad_group','ad_group_ad')),entity_id text NOT NULL,source jsonb NOT NULL,
 api_version text NOT NULL,synced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,connection_id,customer_id,level,entity_id),
 FOREIGN KEY(workspace_id,connection_id,customer_id) REFERENCES google_ads_accounts(workspace_id,connection_id,customer_id) ON DELETE CASCADE
);
CREATE TABLE google_ads_facts (
 workspace_id uuid NOT NULL,connection_id uuid NOT NULL,customer_id text NOT NULL,
 level text NOT NULL CHECK(level IN('campaign','ad_group','ad_group_ad')),entity_id text NOT NULL,day date NOT NULL,
 source jsonb NOT NULL,currency text NOT NULL,timezone_name text NOT NULL,api_version text NOT NULL,
 synced_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,connection_id,customer_id,level,entity_id,day),
 FOREIGN KEY(workspace_id,connection_id,customer_id) REFERENCES google_ads_accounts(workspace_id,connection_id,customer_id) ON DELETE CASCADE
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['google_ads_oauth_states','google_ads_accounts','google_ads_entities','google_ads_facts'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid))',t,t);
  EXECUTE format('CREATE POLICY tenant_write ON %I FOR ALL USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin''))) WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin'')))',t,t,t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON google_ads_oauth_states,google_ads_accounts,google_ads_entities,google_ads_facts TO northstar_app;
