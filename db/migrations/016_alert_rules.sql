CREATE TABLE alert_rules (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),enabled boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 last_checked_at timestamptz,last_alert_at timestamptz,last_result jsonb,
 PRIMARY KEY(workspace_id,id)
);
CREATE INDEX alert_rules_due ON alert_rules(workspace_id,enabled,last_checked_at);
CREATE TABLE alert_rule_runs (
 workspace_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),rule_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES users,dry_run boolean NOT NULL,result jsonb NOT NULL,definition jsonb NOT NULL,
 outcome text NOT NULL CHECK(outcome IN('dry_run','evaluated','cooldown','alert_created')),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,rule_id) REFERENCES alert_rules(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE rule_alerts (
 workspace_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),rule_id uuid NOT NULL,
 rule_name text NOT NULL,definition jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,reviewed_by uuid REFERENCES users,
 PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,rule_id) REFERENCES alert_rules(workspace_id,id) ON DELETE CASCADE,
 CHECK((reviewed_at IS NULL)=(reviewed_by IS NULL))
);
CREATE INDEX rule_alerts_recent ON rule_alerts(workspace_id,created_at DESC);
CREATE INDEX alert_rule_runs_recent ON alert_rule_runs(workspace_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['alert_rules','alert_rule_runs','rule_alerts'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY rule_read ON %I FOR SELECT USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=%I.workspace_id AND user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid))',t,t);
  EXECUTE format('CREATE POLICY rule_manage ON %I FOR ALL USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=%I.workspace_id AND user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND role IN(''owner'',''admin''))) WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=%I.workspace_id AND user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND role IN(''owner'',''admin'')))',t,t,t);
 END LOOP;
END $$;
REVOKE ALL ON alert_rules,alert_rule_runs,rule_alerts FROM PUBLIC,northstar_app;
GRANT SELECT,INSERT,UPDATE ON alert_rules TO northstar_app;
GRANT SELECT,INSERT ON alert_rule_runs,rule_alerts TO northstar_app;
GRANT UPDATE(reviewed_at,reviewed_by) ON rule_alerts TO northstar_app;
