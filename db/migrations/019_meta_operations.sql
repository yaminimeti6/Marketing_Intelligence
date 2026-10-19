CREATE TABLE meta_operations (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),connection_id uuid NOT NULL,account_id text NOT NULL CHECK(account_id~'^[0-9]+$'),currency text NOT NULL,
 kind text NOT NULL CHECK(kind IN('create_campaign','status','daily_budget')),payload jsonb NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','finished','cancelled')),
 created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),approved_by uuid REFERENCES users,approved_at timestamptz,
 PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,connection_id) REFERENCES provider_connections(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE meta_operation_items (
 workspace_id uuid NOT NULL,operation_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),target_id text,snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','running','succeeded','failed','uncertain')),result_id text,error_code text,finished_at timestamptz,
 PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,operation_id) REFERENCES meta_operations(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX meta_operation_history ON meta_operations(workspace_id,created_at DESC);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['meta_operations','meta_operation_items'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY operation_read ON %I FOR SELECT USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid))',t,t);
 EXECUTE format('CREATE POLICY operation_manage ON %I FOR ALL USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin''))) WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin'')))',t,t,t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,northstar_app',t);EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO northstar_app',t);
END LOOP;END $$;
