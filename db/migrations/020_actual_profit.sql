CREATE TABLE actual_profit_costs (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE, store_id uuid NOT NULL,
 from_day date NOT NULL,to_day date NOT NULL,currency text NOT NULL,timezone text NOT NULL,
 costs jsonb NOT NULL,updated_by uuid NOT NULL REFERENCES users,updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(to_day>=from_day AND to_day-from_day<=90),
 PRIMARY KEY(workspace_id,store_id,from_day,to_day),
 FOREIGN KEY(workspace_id,store_id) REFERENCES shopify_stores(workspace_id,connection_id) ON DELETE CASCADE
);
ALTER TABLE actual_profit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_profit_costs FORCE ROW LEVEL SECURITY;
CREATE POLICY profit_read ON actual_profit_costs FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=actual_profit_costs.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY profit_write ON actual_profit_costs FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=actual_profit_costs.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=actual_profit_costs.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin')));
REVOKE ALL ON actual_profit_costs FROM PUBLIC,northstar_app;
GRANT SELECT,INSERT,UPDATE ON actual_profit_costs TO northstar_app;
