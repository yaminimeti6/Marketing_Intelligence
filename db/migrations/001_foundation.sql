CREATE TABLE workspaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL CHECK(email=lower(email)), name text NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE memberships (workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, role text NOT NULL CHECK(role IN ('owner','admin','viewer')), PRIMARY KEY(workspace_id,user_id));
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL, workspace_id uuid NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(workspace_id,user_id) REFERENCES memberships(workspace_id,user_id) ON DELETE CASCADE);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_attempts (identity_hash text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now());

CREATE TABLE provider_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('meta','shopify')), status text NOT NULL DEFAULT 'disconnected' CHECK(status IN ('disconnected','pending','connected','reauthorization_required','error')),
  external_id text NOT NULL, scopes text[] NOT NULL DEFAULT '{}', expires_at timestamptz,
  last_success_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,provider,external_id)
);
CREATE TABLE encrypted_credentials (
  workspace_id uuid NOT NULL, connection_id uuid NOT NULL, envelope text NOT NULL, key_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,connection_id),
  FOREIGN KEY(workspace_id,connection_id) REFERENCES provider_connections(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE sync_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, connection_id uuid NOT NULL,
  provider text NOT NULL CHECK(provider IN ('meta','shopify')), dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','dead')),
  attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz, last_error_code text, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,provider,dedupe_key),
  FOREIGN KEY(workspace_id,connection_id) REFERENCES provider_connections(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX sync_jobs_claim ON sync_jobs(provider,status,available_at);
CREATE TABLE sync_cursors (
  workspace_id uuid NOT NULL, connection_id uuid NOT NULL, resource text NOT NULL, cursor text, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,connection_id,resource), FOREIGN KEY(workspace_id,connection_id) REFERENCES provider_connections(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE audit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  actor_id uuid REFERENCES users, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,id)
);

-- Runtime role must be a non-owner, non-superuser, without BYPASSRLS.
-- The migration role owns the schema and must never be used by the web application.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['provider_connections','encrypted_credentials','sync_jobs','sync_cursors','audit_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT USING (workspace_id = nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS (SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid))', t,t);
    EXECUTE format('CREATE POLICY tenant_write ON %I FOR ALL USING (workspace_id = nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS (SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN (''owner'',''admin''))) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS (SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN (''owner'',''admin'')))', t,t,t);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO northstar_app;
-- Identity tables are private server authentication infrastructure; never expose generic CRUD.
GRANT SELECT ON users,workspaces,memberships TO northstar_app;
GRANT SELECT,INSERT,DELETE ON sessions TO northstar_app;
GRANT SELECT,INSERT,UPDATE ON login_attempts TO northstar_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON provider_connections,encrypted_credentials,sync_jobs,sync_cursors TO northstar_app;
GRANT SELECT,INSERT ON audit_events TO northstar_app;
