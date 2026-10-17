-- Receipt metadata only: never persist customer/order webhook payloads.
CREATE TABLE shopify_webhook_receipts (
 workspace_id uuid NOT NULL,connection_id uuid NOT NULL,topic text NOT NULL,
 event_id text NOT NULL,body_hash text NOT NULL CHECK(body_hash~'^[a-f0-9]{64}$'),received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,connection_id,topic,event_id),UNIQUE(workspace_id,connection_id,topic,body_hash),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES provider_connections(workspace_id,id) ON DELETE CASCADE
);
ALTER TABLE shopify_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_webhook_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY receipt_read ON shopify_webhook_receipts FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_webhook_receipts.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY receipt_manage ON shopify_webhook_receipts FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_webhook_receipts.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_webhook_receipts.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')));
REVOKE ALL ON shopify_webhook_receipts FROM PUBLIC;
GRANT SELECT,INSERT,DELETE ON shopify_webhook_receipts TO northstar_app;
