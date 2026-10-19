ALTER TABLE shopify_pixel_sources ADD COLUMN measurement_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE journey_events (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,source_id uuid NOT NULL REFERENCES shopify_pixel_sources ON DELETE CASCADE,
 event_hash text NOT NULL CHECK(event_hash~'^[a-f0-9]{64}$'),visitor_hash text NOT NULL CHECK(visitor_hash~'^[a-f0-9]{64}$'),customer_hash text CHECK(customer_hash~'^[a-f0-9]{64}$'),
 event_name text NOT NULL CHECK(event_name IN('page_viewed','checkout_completed')),channel text NOT NULL CHECK(channel IN('meta','organic','direct','other')),
 order_id text CHECK(order_id~'^gid://shopify/Order/[0-9]+$'),occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source_id,event_hash),
 CHECK((event_name='checkout_completed' AND order_id IS NOT NULL) OR (event_name='page_viewed' AND order_id IS NULL AND customer_hash IS NULL))
);
CREATE INDEX journey_visitors ON journey_events(workspace_id,source_id,visitor_hash,occurred_at);
CREATE INDEX journey_retention ON journey_events(source_id,received_at);
CREATE UNIQUE INDEX journey_order_once ON journey_events(source_id,order_id) WHERE order_id IS NOT NULL;
ALTER TABLE journey_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY journey_read ON journey_events FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=journey_events.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
REVOKE ALL ON journey_events FROM PUBLIC,northstar_app;GRANT SELECT ON journey_events TO northstar_app;
CREATE FUNCTION receive_journey(p_key text,p_event text,p_visitor text,p_customer text,p_name text,p_channel text,p_order text,p_time timestamptz) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE src public.shopify_pixel_sources%ROWTYPE;connected boolean;days integer;
 old_ws text:=current_setting('app.workspace_id',true);old_user text:=current_setting('app.user_id',true);
BEGIN
 IF coalesce(p_key,'')!~'^[a-f0-9]{64}$' OR coalesce(p_event,'')!~'^[a-f0-9]{64}$' OR coalesce(p_visitor,'')!~'^[a-f0-9]{64}$' OR (p_customer IS NOT NULL AND p_customer!~'^[a-f0-9]{64}$') OR coalesce(p_name,'') NOT IN('page_viewed','checkout_completed') OR coalesce(p_channel,'') NOT IN('meta','organic','direct','other') OR p_time IS NULL OR p_time<now()-interval '24 hours' OR p_time>now()+interval '5 minutes' OR (p_name='checkout_completed' AND (p_order IS NULL OR p_order!~'^gid://shopify/Order/[0-9]+$')) OR (p_name='page_viewed' AND (p_order IS NOT NULL OR p_customer IS NOT NULL)) THEN RETURN 'invalid';END IF;
 SELECT * INTO src FROM public.shopify_pixel_sources WHERE key_hash=p_key AND enabled AND measurement_enabled FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unknown';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=src.workspace_id AND user_id=src.created_by AND role IN('owner','admin')) THEN RETURN 'unknown';END IF;
 PERFORM set_config('app.workspace_id',src.workspace_id::text,true),set_config('app.user_id',src.created_by::text,true);
 SELECT EXISTS(SELECT 1 FROM public.provider_connections WHERE workspace_id=src.workspace_id AND id=src.connection_id AND provider='shopify' AND status='connected') INTO connected;
 PERFORM set_config('app.workspace_id',coalesce(old_ws,''),true),set_config('app.user_id',coalesce(old_user,''),true);
 IF NOT connected THEN RETURN 'unknown';END IF;
 IF p_time<src.rotated_at-interval '5 minutes' THEN RETURN 'invalid';END IF;
 IF EXISTS(SELECT 1 FROM public.journey_events WHERE source_id=src.id AND (event_hash=p_event OR (p_order IS NOT NULL AND order_id=p_order))) THEN RETURN 'duplicate';END IF;
 IF(SELECT count(*) FROM public.journey_events WHERE source_id=src.id AND received_at>now()-interval '1 minute')>=300 THEN RETURN 'limited';END IF;
 SELECT browser_event_retention_days INTO days FROM public.workspaces WHERE id=src.workspace_id;
 DELETE FROM public.journey_events WHERE source_id=src.id AND received_at<now()-(days*interval '1 day');
 INSERT INTO public.journey_events(workspace_id,source_id,event_hash,visitor_hash,customer_hash,event_name,channel,order_id,occurred_at) VALUES(src.workspace_id,src.id,p_event,p_visitor,p_customer,p_name,p_channel,p_order,p_time);
 RETURN 'accepted';
END $$;
REVOKE ALL ON FUNCTION receive_journey(text,text,text,text,text,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION receive_journey(text,text,text,text,text,text,text,timestamptz) TO northstar_app;
CREATE OR REPLACE FUNCTION shopify_purge_retained_events() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ws uuid:=nullif(current_setting('app.workspace_id',true),'')::uuid;actor uuid:=nullif(current_setting('app.user_id',true),'')::uuid;days integer;deleted integer;journeys integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=ws AND user_id=actor AND role IN('owner','admin')) THEN RAISE EXCEPTION 'retention_permission';END IF;
 SELECT browser_event_retention_days INTO days FROM public.workspaces WHERE id=ws;
 DELETE FROM public.shopify_customer_events WHERE workspace_id=ws AND received_at<now()-(days*interval '1 day');GET DIAGNOSTICS deleted=ROW_COUNT;
 DELETE FROM public.journey_events WHERE workspace_id=ws AND received_at<now()-(days*interval '1 day');GET DIAGNOSTICS journeys=ROW_COUNT;RETURN deleted+journeys;
END $$;
