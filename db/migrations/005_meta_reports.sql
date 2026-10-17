CREATE TABLE report_presets (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 filters jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,user_id,name)
);
CREATE TABLE report_exports (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,filters jsonb NOT NULL,row_count integer NOT NULL CHECK(row_count>=0),
 complete boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,id)
);
CREATE INDEX report_exports_user_time ON report_exports(workspace_id,user_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['report_presets','report_exports'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY own_reports ON %I FOR ALL USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=%I.user_id)) WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=%I.user_id))',t,t,t,t,t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON report_presets TO northstar_app;
-- Export history is append-only for runtime users, including viewers.
GRANT SELECT,INSERT ON report_exports TO northstar_app;
