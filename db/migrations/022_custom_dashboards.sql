CREATE TABLE custom_dashboards (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 definition jsonb NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),updated_by uuid NOT NULL REFERENCES users,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,id)
);
ALTER TABLE custom_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_dashboards FORCE ROW LEVEL SECURITY;
CREATE POLICY dashboard_read ON custom_dashboards FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=custom_dashboards.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY dashboard_manage ON custom_dashboards FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=custom_dashboards.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=custom_dashboards.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin')));
REVOKE ALL ON custom_dashboards FROM PUBLIC,northstar_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON custom_dashboards TO northstar_app;
