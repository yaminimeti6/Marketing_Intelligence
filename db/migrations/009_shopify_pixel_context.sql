-- Preserve caller context across public capability ingestion, including explicit transactions.
CREATE OR REPLACE FUNCTION shopify_receive_event(p_key text,p_hash text,p_name text,p_product text,p_quantity integer,p_time timestamptz) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE src public.shopify_pixel_sources%ROWTYPE;connected boolean;
 old_workspace text:=current_setting('app.workspace_id',true);old_user text:=current_setting('app.user_id',true);
BEGIN
 IF coalesce(p_key,'')!~'^[a-f0-9]{64}$' OR coalesce(p_hash,'')!~'^[a-f0-9]{64}$' OR coalesce(p_name,'') NOT IN('product_viewed','product_added_to_cart','checkout_started') OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 1000 OR p_time IS NULL OR p_time<now()-interval '24 hours' OR p_time>now()+interval '5 minutes' OR (p_product IS NOT NULL AND p_product!~'^gid://shopify/Product/[0-9]+$') OR (p_name<>'checkout_started' AND p_product IS NULL) THEN RETURN 'invalid';END IF;
 SELECT * INTO src FROM public.shopify_pixel_sources WHERE key_hash=p_key AND enabled FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unknown';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=src.workspace_id AND user_id=src.created_by AND role IN('owner','admin')) THEN RETURN 'unknown';END IF;
 PERFORM set_config('app.workspace_id',src.workspace_id::text,true),set_config('app.user_id',src.created_by::text,true);
 SELECT EXISTS(SELECT 1 FROM public.provider_connections WHERE id=src.connection_id AND workspace_id=src.workspace_id AND provider='shopify' AND status='connected') INTO connected;
 -- A public write key must never become a tenant read capability for the caller.
 PERFORM set_config('app.workspace_id',coalesce(old_workspace,''),true),set_config('app.user_id',coalesce(old_user,''),true);
 IF NOT connected THEN RETURN 'unknown';END IF;
 IF p_time<src.rotated_at-interval '5 minutes' THEN RETURN 'invalid';END IF;
 IF EXISTS(SELECT 1 FROM public.shopify_customer_events WHERE source_id=src.id AND event_hash=p_hash) THEN RETURN 'duplicate';END IF;
 IF(SELECT count(*) FROM public.shopify_customer_events WHERE source_id=src.id AND received_at>now()-interval '1 minute')>=600 THEN RETURN 'limited';END IF;
 DELETE FROM public.shopify_customer_events WHERE source_id=src.id AND received_at<now()-interval '90 days';
 INSERT INTO public.shopify_customer_events(source_id,workspace_id,event_hash,event_name,product_id,quantity,occurred_at) VALUES(src.id,src.workspace_id,p_hash,p_name,p_product,p_quantity,p_time);
 RETURN 'accepted';
END $$;
REVOKE ALL ON FUNCTION shopify_receive_event(text,text,text,text,integer,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shopify_receive_event(text,text,text,text,integer,timestamptz) TO northstar_app;
