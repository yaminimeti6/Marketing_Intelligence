CREATE TABLE report_schedules (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL REFERENCES users,definition jsonb NOT NULL,enabled boolean NOT NULL DEFAULT false,
 next_run_at timestamptz NOT NULL,last_run_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id)
);
CREATE TABLE scheduled_report_runs (
 workspace_id uuid NOT NULL,schedule_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),slot text NOT NULL,
 report_name text NOT NULL,definition jsonb NOT NULL,result jsonb NOT NULL,csv text CHECK(octet_length(csv)<=2000000),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,schedule_id,slot),
 FOREIGN KEY(workspace_id,schedule_id) REFERENCES report_schedules(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX report_due ON report_schedules(workspace_id,next_run_at) WHERE enabled;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['report_schedules','scheduled_report_runs'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY schedule_read ON %I FOR SELECT USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid))',t,t);
 EXECUTE format('CREATE POLICY schedule_manage ON %I FOR ALL USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin''))) WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin'')))',t,t,t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,northstar_app',t);
END LOOP;END $$;
GRANT SELECT,INSERT,UPDATE ON report_schedules TO northstar_app;
GRANT SELECT,INSERT,DELETE ON scheduled_report_runs TO northstar_app;
CREATE TABLE scheduled_report_emails (
 workspace_id uuid NOT NULL,run_id uuid NOT NULL,recipient_id uuid NOT NULL REFERENCES users,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sending','accepted','failed','uncertain','skipped')),
 error_code text,provider_id text,claimed_at timestamptz,finished_at timestamptz,
 PRIMARY KEY(workspace_id,run_id),FOREIGN KEY(workspace_id,run_id) REFERENCES scheduled_report_runs(workspace_id,id) ON DELETE CASCADE
);
ALTER TABLE scheduled_report_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_report_emails FORCE ROW LEVEL SECURITY;
CREATE POLICY schedule_mail_read ON scheduled_report_emails FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=scheduled_report_emails.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY schedule_mail_manage ON scheduled_report_emails FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=scheduled_report_emails.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=scheduled_report_emails.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin')));
REVOKE ALL ON scheduled_report_emails FROM PUBLIC,northstar_app;
GRANT SELECT,INSERT,UPDATE ON scheduled_report_emails TO northstar_app;
