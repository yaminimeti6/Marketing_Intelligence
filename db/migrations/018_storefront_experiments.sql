ALTER TABLE shopify_pixel_sources ADD CONSTRAINT pixel_source_workspace_id UNIQUE(workspace_id,id);
CREATE TABLE storefront_experiments (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES shopify_pixel_sources ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 3 AND 100),kind text NOT NULL CHECK(kind IN('headline','landing')),entry_path text NOT NULL CHECK(entry_path~'^/'),variant_a text NOT NULL CHECK(length(variant_a) BETWEEN 1 AND 300),variant_b text NOT NULL CHECK(length(variant_b) BETWEEN 1 AND 300),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','running','stopped')),created_at timestamptz NOT NULL DEFAULT now(),started_at timestamptz,ends_at timestamptz,PRIMARY KEY(workspace_id,id),UNIQUE(id),CHECK(variant_a<>variant_b),FOREIGN KEY(workspace_id,source_id) REFERENCES shopify_pixel_sources(workspace_id,id) ON DELETE CASCADE
);
ALTER TABLE storefront_experiments ENABLE ROW LEVEL SECURITY;ALTER TABLE storefront_experiments FORCE ROW LEVEL SECURITY;
CREATE POLICY experiment_read ON storefront_experiments FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=storefront_experiments.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY experiment_manage ON storefront_experiments FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=storefront_experiments.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=storefront_experiments.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin')));
GRANT SELECT,INSERT,UPDATE ON storefront_experiments TO northstar_app;
CREATE TABLE experiment_exposures (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,experiment_id uuid NOT NULL,source_id uuid NOT NULL REFERENCES shopify_pixel_sources ON DELETE CASCADE,visitor_hash text NOT NULL CHECK(visitor_hash~'^[a-f0-9]{64}$'),variant text NOT NULL CHECK(variant IN('A','B')),occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(experiment_id,visitor_hash),FOREIGN KEY(workspace_id,experiment_id) REFERENCES storefront_experiments(workspace_id,id) ON DELETE CASCADE
);
ALTER TABLE experiment_exposures ENABLE ROW LEVEL SECURITY;
CREATE POLICY exposure_read ON experiment_exposures FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=experiment_exposures.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
REVOKE ALL ON experiment_exposures FROM PUBLIC,northstar_app;GRANT SELECT ON experiment_exposures TO northstar_app;
CREATE INDEX exposure_retention ON experiment_exposures(source_id,received_at);
CREATE FUNCTION receive_exposure(p_key text,p_experiment uuid,p_visitor text,p_variant text,p_time timestamptz) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE src public.shopify_pixel_sources%ROWTYPE;valid boolean;old_ws text:=current_setting('app.workspace_id',true);old_user text:=current_setting('app.user_id',true);
BEGIN
 IF coalesce(p_key,'')!~'^[a-f0-9]{64}$' OR coalesce(p_visitor,'')!~'^[a-f0-9]{64}$' OR coalesce(p_variant,'') NOT IN('A','B') OR p_time IS NULL OR p_time<now()-interval '24 hours' OR p_time>now()+interval '5 minutes' THEN RETURN 'invalid';END IF;
 SELECT * INTO src FROM public.shopify_pixel_sources WHERE key_hash=p_key AND enabled AND measurement_enabled FOR UPDATE;IF NOT FOUND THEN RETURN 'unknown';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=src.workspace_id AND user_id=src.created_by AND role IN('owner','admin')) THEN RETURN 'unknown';END IF;
 PERFORM set_config('app.workspace_id',src.workspace_id::text,true),set_config('app.user_id',src.created_by::text,true);
 SELECT EXISTS(SELECT 1 FROM public.storefront_experiments e JOIN public.provider_connections p ON p.id=src.connection_id AND p.workspace_id=e.workspace_id WHERE e.id=p_experiment AND e.workspace_id=src.workspace_id AND e.source_id=src.id AND e.status='running' AND p.status='connected' AND p_time>=e.started_at AND p_time<=e.ends_at AND now()<=e.ends_at) INTO valid;
 PERFORM set_config('app.workspace_id',coalesce(old_ws,''),true),set_config('app.user_id',coalesce(old_user,''),true);
 IF NOT valid THEN RETURN 'unknown';END IF;
 IF EXISTS(SELECT 1 FROM public.experiment_exposures WHERE experiment_id=p_experiment AND visitor_hash=p_visitor) THEN RETURN 'duplicate';END IF;
 IF(SELECT count(*) FROM public.experiment_exposures WHERE source_id=src.id AND received_at>now()-interval '1 minute')>=300 THEN RETURN 'limited';END IF;
 DELETE FROM public.experiment_exposures WHERE source_id=src.id AND received_at<now()-((SELECT browser_event_retention_days FROM public.workspaces WHERE id=src.workspace_id)*interval '1 day');
 INSERT INTO public.experiment_exposures(workspace_id,experiment_id,source_id,visitor_hash,variant,occurred_at) VALUES(src.workspace_id,p_experiment,src.id,p_visitor,p_variant,p_time);RETURN 'accepted';
END $$;
REVOKE ALL ON FUNCTION receive_exposure(text,uuid,text,text,timestamptz) FROM PUBLIC;GRANT EXECUTE ON FUNCTION receive_exposure(text,uuid,text,text,timestamptz) TO northstar_app;
CREATE OR REPLACE FUNCTION shopify_purge_retained_events() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ws uuid:=nullif(current_setting('app.workspace_id',true),'')::uuid;actor uuid:=nullif(current_setting('app.user_id',true),'')::uuid;days integer;deleted integer;n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=ws AND user_id=actor AND role IN('owner','admin')) THEN RAISE EXCEPTION 'retention_permission';END IF;
 SELECT browser_event_retention_days INTO days FROM public.workspaces WHERE id=ws;
 DELETE FROM public.shopify_customer_events WHERE workspace_id=ws AND received_at<now()-(days*interval '1 day');GET DIAGNOSTICS deleted=ROW_COUNT;
 DELETE FROM public.journey_events WHERE workspace_id=ws AND received_at<now()-(days*interval '1 day');GET DIAGNOSTICS n=ROW_COUNT;deleted:=deleted+n;
 DELETE FROM public.experiment_exposures WHERE workspace_id=ws AND received_at<now()-(days*interval '1 day');GET DIAGNOSTICS n=ROW_COUNT;RETURN deleted+n;
END $$;
