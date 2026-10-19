CREATE TABLE capi_settings(workspace_id uuid NOT NULL,source_id uuid NOT NULL,pixel_id text NOT NULL CHECK(pixel_id~'^[0-9]+$'),envelope jsonb NOT NULL,enabled boolean NOT NULL DEFAULT false,created_by uuid NOT NULL REFERENCES users,PRIMARY KEY(workspace_id,source_id),FOREIGN KEY(workspace_id,source_id) REFERENCES shopify_pixel_sources(workspace_id,id) ON DELETE CASCADE);
CREATE TABLE capi_events(workspace_id uuid NOT NULL,source_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),order_id text NOT NULL,event_id text NOT NULL,event_time timestamptz NOT NULL,envelope jsonb,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sending','accepted','failed','uncertain','expired')),error_code text,created_at timestamptz NOT NULL DEFAULT now(),available_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,source_id,order_id),FOREIGN KEY(workspace_id,source_id) REFERENCES capi_settings(workspace_id,source_id) ON DELETE CASCADE);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['capi_settings','capi_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY capi_read ON %I FOR SELECT USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid))',t,t);
 EXECUTE format('CREATE POLICY capi_manage ON %I FOR ALL USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin''))) WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=%I.workspace_id AND m.user_id=nullif(current_setting(''app.user_id'',true),'''')::uuid AND m.role IN(''owner'',''admin'')))',t,t,t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,northstar_app',t);EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO northstar_app',t);
END LOOP;END $$;
CREATE FUNCTION capi_source(p_hash text) RETURNS TABLE(workspace_id uuid,source_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE src public.shopify_pixel_sources%ROWTYPE;manager uuid;connected boolean;old_ws text:=current_setting('app.workspace_id',true);old_user text:=current_setting('app.user_id',true);
BEGIN
 SELECT * INTO src FROM public.shopify_pixel_sources WHERE key_hash=p_hash AND enabled AND measurement_enabled;
 IF NOT FOUND THEN RETURN;END IF;
 SELECT created_by INTO manager FROM public.capi_settings WHERE capi_settings.workspace_id=src.workspace_id AND capi_settings.source_id=src.id AND enabled;
 IF manager IS NULL OR NOT EXISTS(SELECT 1 FROM public.memberships WHERE memberships.workspace_id=src.workspace_id AND user_id=manager AND role IN('owner','admin')) THEN RETURN;END IF;
 PERFORM set_config('app.workspace_id',src.workspace_id::text,true),set_config('app.user_id',manager::text,true);
 SELECT EXISTS(SELECT 1 FROM public.provider_connections WHERE provider_connections.workspace_id=src.workspace_id AND id=src.connection_id AND provider='shopify' AND status='connected') INTO connected;
 PERFORM set_config('app.workspace_id',coalesce(old_ws,''),true),set_config('app.user_id',coalesce(old_user,''),true);
 IF connected THEN RETURN QUERY SELECT src.workspace_id,src.id;END IF;
END $$;
CREATE FUNCTION receive_capi(p_hash text,p_order text,p_event text,p_time timestamptz,p_envelope jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$DECLARE src record;BEGIN
 SELECT * INTO src FROM capi_source(p_hash);IF src.source_id IS NULL OR p_order!~'^gid://shopify/Order/[0-9]+$' OR p_event!~'^ns_[a-f0-9]{64}$' OR p_time<now()-interval '1 day' OR p_time>now()+interval '5 minutes' OR octet_length(p_envelope::text)>5000 THEN RETURN false;END IF;
 PERFORM pg_advisory_xact_lock(hashtext(src.source_id::text));IF(SELECT count(*) FROM capi_events WHERE source_id=src.source_id AND created_at>now()-interval '1 minute')>=300 THEN RETURN false;END IF;
 INSERT INTO capi_events(workspace_id,source_id,order_id,event_id,event_time,envelope) VALUES(src.workspace_id,src.source_id,p_order,p_event,p_time,p_envelope) ON CONFLICT DO NOTHING;RETURN true;END $$;
REVOKE ALL ON FUNCTION capi_source(text),receive_capi(text,text,text,timestamptz,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capi_source(text),receive_capi(text,text,text,timestamptz,jsonb) TO northstar_app;
