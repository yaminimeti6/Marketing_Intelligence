CREATE TABLE creative_assets (
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,id uuid NOT NULL DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),tags text[] NOT NULL DEFAULT '{}',notes text NOT NULL DEFAULT '',source text NOT NULL CHECK(source IN('upload','ai_image')),
 kind text NOT NULL CHECK(kind IN('image','video')),mime text NOT NULL CHECK(mime IN('image/webp','video/mp4','video/webm')),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 4000000),thumbnail bytea CHECK(octet_length(thumbnail)<=100000),
 width integer,height integer,content_hash text NOT NULL CHECK(content_hash~'^[a-f0-9]{64}$'),archived boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,content_hash),CHECK(cardinality(tags)<=8),CHECK(length(notes)<=500),
 CHECK((kind='image' AND mime='image/webp' AND octet_length(content)<=2000000 AND thumbnail IS NOT NULL AND width>0 AND height>0) OR (kind='video' AND mime IN('video/mp4','video/webm') AND thumbnail IS NULL))
);
ALTER TABLE creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY creative_read ON creative_assets FOR SELECT USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=creative_assets.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid));
CREATE POLICY creative_manage ON creative_assets FOR ALL USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=creative_assets.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin'))) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid AND EXISTS(SELECT 1 FROM memberships m WHERE m.workspace_id=creative_assets.workspace_id AND m.user_id=nullif(current_setting('app.user_id',true),'')::uuid AND m.role IN('owner','admin')));
REVOKE ALL ON creative_assets FROM PUBLIC,northstar_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON creative_assets TO northstar_app;
