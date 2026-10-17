CREATE TABLE shopify_abandoned_checkouts (
 workspace_id uuid NOT NULL,connection_id uuid NOT NULL,entity_id text NOT NULL,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,completed_at timestamptz,
 amount numeric(30,6),currency text CHECK(currency IS NULL OR currency~'^[A-Z]{3}$'),synced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,connection_id,entity_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES shopify_stores(workspace_id,connection_id) ON DELETE CASCADE
);
ALTER TABLE shopify_abandoned_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_abandoned_checkouts FORCE ROW LEVEL SECURITY;
CREATE POLICY checkout_read ON shopify_abandoned_checkouts FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_abandoned_checkouts.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY checkout_write ON shopify_abandoned_checkouts FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_abandoned_checkouts.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_abandoned_checkouts.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')));
GRANT SELECT,INSERT,UPDATE,DELETE ON shopify_abandoned_checkouts TO northstar_app;
