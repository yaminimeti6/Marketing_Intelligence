CREATE TABLE growth_documents (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN('funnel','research','launch')),
 definition jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,public_key text NOT NULL DEFAULT replace(gen_random_uuid()::text,'-',''),published boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,id),UNIQUE(public_key),CHECK(NOT published OR kind='funnel')
);
ALTER TABLE growth_documents ENABLE ROW LEVEL SECURITY;
-- Only the narrow public-page definer may bypass RLS as table owner. Runtime is a non-owner.
ALTER TABLE growth_documents NO FORCE ROW LEVEL SECURITY;
CREATE POLICY growth_read ON growth_documents FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=growth_documents.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY growth_manage ON growth_documents FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=growth_documents.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=growth_documents.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin')));
REVOKE ALL ON growth_documents FROM PUBLIC,northstar_app;
GRANT SELECT,INSERT,UPDATE ON growth_documents TO northstar_app;
CREATE FUNCTION published_funnel(p_key text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('headline',definition->>'headline','body',definition->>'body','cta',definition->>'cta','target',definition->>'target','theme',definition->>'theme') FROM growth_documents WHERE public_key=p_key AND kind='funnel' AND published
$$;
REVOKE ALL ON FUNCTION published_funnel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published_funnel(text) TO northstar_app;
