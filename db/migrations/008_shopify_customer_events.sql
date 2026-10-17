-- Public browser events use a write-only source capability, never a Shopify token.
CREATE TABLE shopify_pixel_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,connection_id uuid NOT NULL,
 key_hash text UNIQUE NOT NULL CHECK(key_hash~'^[a-f0-9]{64}$'),enabled boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),rotated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,connection_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES shopify_stores(workspace_id,connection_id) ON DELETE CASCADE
);
CREATE TABLE shopify_customer_events (
 source_id uuid NOT NULL REFERENCES shopify_pixel_sources ON DELETE CASCADE,workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 event_hash text NOT NULL CHECK(event_hash~'^[a-f0-9]{64}$'),event_name text NOT NULL CHECK(event_name IN('product_viewed','product_added_to_cart','checkout_started')),
 product_id text,quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000),occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_id,event_hash),CHECK(product_id IS NULL OR product_id~'^gid://shopify/Product/[0-9]+$')
);
CREATE INDEX shopify_event_time ON shopify_customer_events(source_id,received_at);
CREATE INDEX shopify_event_report ON shopify_customer_events(workspace_id,source_id,occurred_at);
-- RLS restricts runtime reads/writes. Only the narrow definer ingestion function
-- bypasses RLS as table owner to resolve a public write capability before tenant context exists.
ALTER TABLE shopify_pixel_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_customer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY source_read ON shopify_pixel_sources FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_pixel_sources.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY source_manage ON shopify_pixel_sources FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_pixel_sources.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_pixel_sources.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid AND role IN('owner','admin')));
CREATE POLICY event_read ON shopify_customer_events FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=shopify_customer_events.workspace_id AND user_id=nullif(current_setting('app.user_id',true),'')::uuid));
REVOKE ALL ON shopify_pixel_sources,shopify_customer_events FROM PUBLIC,northstar_app;
GRANT SELECT,INSERT,UPDATE ON shopify_pixel_sources TO northstar_app;
GRANT SELECT ON shopify_customer_events TO northstar_app;

CREATE FUNCTION shopify_receive_event(p_key text,p_hash text,p_name text,p_product text,p_quantity integer,p_time timestamptz) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE src public.shopify_pixel_sources%ROWTYPE;
BEGIN
 IF coalesce(p_key,'')!~'^[a-f0-9]{64}$' OR coalesce(p_hash,'')!~'^[a-f0-9]{64}$' OR coalesce(p_name,'') NOT IN('product_viewed','product_added_to_cart','checkout_started') OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 1000 OR p_time IS NULL OR p_time<now()-interval '24 hours' OR p_time>now()+interval '5 minutes' OR (p_product IS NOT NULL AND p_product!~'^gid://shopify/Product/[0-9]+$') OR (p_name<>'checkout_started' AND p_product IS NULL) THEN RETURN 'invalid';END IF;
 SELECT * INTO src FROM public.shopify_pixel_sources WHERE key_hash=p_key AND enabled FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unknown';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=src.workspace_id AND user_id=src.created_by AND role IN('owner','admin')) THEN RETURN 'unknown';END IF;
 PERFORM set_config('app.workspace_id',src.workspace_id::text,true),set_config('app.user_id',src.created_by::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.provider_connections WHERE id=src.connection_id AND workspace_id=src.workspace_id AND provider='shopify' AND status='connected') THEN RETURN 'unknown';END IF;
 IF p_time<src.rotated_at-interval '5 minutes' THEN RETURN 'invalid';END IF;
 IF EXISTS(SELECT 1 FROM public.shopify_customer_events WHERE source_id=src.id AND event_hash=p_hash) THEN RETURN 'duplicate';END IF;
 IF(SELECT count(*) FROM public.shopify_customer_events WHERE source_id=src.id AND received_at>now()-interval '1 minute')>=600 THEN RETURN 'limited';END IF;
 DELETE FROM public.shopify_customer_events WHERE source_id=src.id AND received_at<now()-interval '90 days';
 INSERT INTO public.shopify_customer_events(source_id,workspace_id,event_hash,event_name,product_id,quantity,occurred_at) VALUES(src.id,src.workspace_id,p_hash,p_name,p_product,p_quantity,p_time);
 RETURN 'accepted';
END $$;
REVOKE ALL ON FUNCTION shopify_receive_event(text,text,text,text,integer,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shopify_receive_event(text,text,text,text,integer,timestamptz) TO northstar_app;
