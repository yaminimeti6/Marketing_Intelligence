CREATE TABLE shopify_oauth_states (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 state_hash text NOT NULL,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 session_hash text NOT NULL,shop_domain text NOT NULL,expires_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,state_hash)
);
CREATE TABLE shopify_stores (
 workspace_id uuid NOT NULL,connection_id uuid NOT NULL,shop_domain text NOT NULL,
 name text NOT NULL,currency text NOT NULL,timezone_name text NOT NULL,
 discovered_at timestamptz NOT NULL DEFAULT now(),last_synced_at timestamptz,
 PRIMARY KEY(workspace_id,connection_id),UNIQUE(workspace_id,shop_domain),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES provider_connections(workspace_id,id) ON DELETE CASCADE
);
-- Restricted commerce snapshots contain only fields explicitly requested by our queries.
-- Financial reporting is a separate reconciliation step; these are not sales aggregates.
CREATE TABLE shopify_records (
 workspace_id uuid NOT NULL,connection_id uuid NOT NULL,resource text NOT NULL CHECK(resource IN('orders','products')),
 entity_id text NOT NULL,source jsonb NOT NULL,api_version text NOT NULL,synced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,connection_id,resource,entity_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES shopify_stores(workspace_id,connection_id) ON DELETE CASCADE
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['shopify_oauth_states','shopify_stores','shopify_records'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid))',t,t);
  EXECUTE format('CREATE POLICY tenant_write ON %I FOR ALL USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin''))) WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin'')))',t,t,t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON shopify_oauth_states,shopify_stores,shopify_records TO northstar_app;
