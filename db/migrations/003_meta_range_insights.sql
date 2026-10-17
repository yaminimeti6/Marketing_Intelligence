-- Exact-range reach comes from Meta; daily or cross-account reach is never summed.
CREATE TABLE meta_range_insights (
  workspace_id uuid NOT NULL, connection_id uuid NOT NULL, account_id text NOT NULL,
  level text NOT NULL CHECK(level IN('account','campaign','adset','ad')), entity_id text NOT NULL,
  date_start date NOT NULL, date_stop date NOT NULL, source jsonb NOT NULL,
  currency text, timezone_name text, api_version text NOT NULL, synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,connection_id,account_id,level,entity_id,date_start,date_stop),
  FOREIGN KEY(workspace_id,connection_id,account_id) REFERENCES meta_ad_accounts(workspace_id,connection_id,account_id) ON DELETE CASCADE,
  CHECK(date_stop>=date_start)
);
ALTER TABLE meta_range_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_range_insights FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON meta_range_insights FOR SELECT USING (
  workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(
    SELECT 1 FROM memberships m WHERE m.workspace_id=meta_range_insights.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid
  )
);
CREATE POLICY tenant_write ON meta_range_insights FOR ALL USING (
  workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(
    SELECT 1 FROM memberships m WHERE m.workspace_id=meta_range_insights.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin')
  )
) WITH CHECK (
  workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(
    SELECT 1 FROM memberships m WHERE m.workspace_id=meta_range_insights.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin')
  )
);
GRANT SELECT,INSERT,UPDATE,DELETE ON meta_range_insights TO northstar_app;
