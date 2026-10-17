-- Analysts can read reporting and maintain personal report presets. They cannot manage integrations or team access.
ALTER TABLE memberships DROP CONSTRAINT memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check CHECK(role IN('owner','admin','analyst','viewer'));
ALTER TABLE team_invitations DROP CONSTRAINT team_invitations_role_check;
ALTER TABLE team_invitations ADD CONSTRAINT team_invitations_role_check CHECK(role IN('admin','analyst','viewer'));
CREATE OR REPLACE FUNCTION team_manage(p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ws uuid:=nullif(current_setting('app.workspace_id',true),'')::uuid;
 actor uuid:=nullif(current_setting('app.user_id',true),'')::uuid;
 browser text:=current_setting('app.session_hash',true); actor_role text;target uuid;old_role text;next_role text;
 target_email text;invite_id uuid;invite_role text;new_name text;new_hash text;target_ws uuid;result jsonb;
BEGIN
 IF actor IS NULL OR ws IS NULL OR NOT EXISTS(SELECT 1 FROM public.sessions s WHERE s.token_hash=browser AND s.user_id=actor AND s.workspace_id=ws AND s.expires_at>now()) THEN RAISE EXCEPTION 'team_permission';END IF;
 IF p_action<>'read' THEN PERFORM 1 FROM public.workspaces WHERE id=ws FOR UPDATE;END IF;
 SELECT role INTO actor_role FROM public.memberships WHERE workspace_id=ws AND user_id=actor;
 IF actor_role IS NULL THEN RAISE EXCEPTION 'team_permission';END IF;
 IF p_action='read' THEN
  RETURN jsonb_build_object(
   'ready',true,'role',actor_role,
   'workspace',(SELECT jsonb_build_object('id',id,'name',name,'currency',preferred_currency,'timezone',preferred_timezone) FROM public.workspaces WHERE id=ws),
   'profile',(SELECT jsonb_build_object('name',name,'email',email,'id',id) FROM public.users WHERE id=actor),
   'workspaces',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'role',m.role) ORDER BY w.name),'[]') FROM public.memberships m JOIN public.workspaces w ON w.id=m.workspace_id WHERE m.user_id=actor),
   'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',m.role) ORDER BY u.name),'[]') FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.workspace_id=ws AND(actor_role IN('owner','admin') OR u.id=actor)),
   'invitations',CASE WHEN actor_role IN('owner','admin') THEN (SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT id,email,role,created_by,created_at,expires_at,revoked_at,accepted_at FROM public.team_invitations WHERE workspace_id=ws ORDER BY created_at DESC LIMIT 50)x) ELSE '[]'::jsonb END,
   'events',CASE WHEN actor_role IN('owner','admin') THEN (SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT action,details,created_at FROM public.team_events WHERE workspace_id=ws ORDER BY created_at DESC LIMIT 20)x) ELSE '[]'::jsonb END
  );
 ELSIF p_action='invite' THEN
  target_email:=lower(trim(p_data->>'email'));invite_role:=p_data->>'role';
  IF actor_role NOT IN('owner','admin') OR invite_role NOT IN('admin','analyst','viewer') OR(actor_role='admin' AND invite_role<>'viewer') THEN RAISE EXCEPTION 'team_permission';END IF;
  IF target_email IS NULL OR length(target_email)>254 OR target_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce(p_data->>'token_hash','')!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'team_input';END IF;
  IF EXISTS(SELECT 1 FROM public.memberships m JOIN public.users u ON u.id=m.user_id WHERE m.workspace_id=ws AND u.email=target_email) THEN RAISE EXCEPTION 'team_already_member';END IF;
  IF(SELECT count(*) FROM public.team_invitations WHERE workspace_id=ws AND created_by=actor AND created_at>now()-interval '1 hour')>=10 OR(SELECT count(*) FROM public.team_invitations WHERE workspace_id=ws AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now())>=100 THEN RAISE EXCEPTION 'team_limit';END IF;
  UPDATE public.team_invitations SET revoked_at=now() WHERE workspace_id=ws AND email=target_email AND accepted_at IS NULL AND revoked_at IS NULL;
  INSERT INTO public.team_invitations(workspace_id,email,role,token_hash,created_by,expires_at) VALUES(ws,target_email,invite_role,p_data->>'token_hash',actor,now()+interval '72 hours') RETURNING id INTO invite_id;
  INSERT INTO public.team_events(workspace_id,actor_id,action,details) VALUES(ws,actor,'invitation.created',jsonb_build_object('email',target_email,'role',invite_role));
  RETURN jsonb_build_object('id',invite_id);
 ELSIF p_action='revoke' THEN
  invite_id:=(p_data->>'id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.team_invitations WHERE id=invite_id AND workspace_id=ws AND accepted_at IS NULL AND revoked_at IS NULL AND(actor_role='owner' OR(actor_role='admin' AND role='viewer' AND created_by=actor))) THEN RAISE EXCEPTION 'team_permission';END IF;
  UPDATE public.team_invitations SET revoked_at=now() WHERE id=invite_id;
  INSERT INTO public.team_events(workspace_id,actor_id,action) VALUES(ws,actor,'invitation.revoked');
 ELSIF p_action IN('role','remove') THEN
  IF actor_role<>'owner' THEN RAISE EXCEPTION 'team_permission';END IF;
  target:=(p_data->>'user_id')::uuid;next_role:=p_data->>'role';
  SELECT role INTO old_role FROM public.memberships WHERE workspace_id=ws AND user_id=target;
  IF old_role IS NULL OR(p_action='role' AND coalesce(next_role,'') NOT IN('owner','admin','analyst','viewer')) THEN RAISE EXCEPTION 'team_input';END IF;
  IF old_role='owner' AND(p_action='remove' OR next_role<>'owner') AND(SELECT count(*) FROM public.memberships WHERE workspace_id=ws AND role='owner')<=1 THEN RAISE EXCEPTION 'team_last_owner';END IF;
  IF p_action='role' AND next_role=old_role THEN RETURN '{}'::jsonb;END IF;
  INSERT INTO public.team_events(workspace_id,actor_id,action,details) VALUES(ws,actor,CASE WHEN p_action='role' THEN 'member.role_changed' ELSE 'member.removed' END,jsonb_build_object('user_id',target,'previous_role',old_role,'role',CASE WHEN p_action='role' THEN next_role ELSE NULL END));
  DELETE FROM public.sessions WHERE workspace_id=ws AND user_id=target;
  IF p_action='role' THEN UPDATE public.memberships SET role=next_role WHERE workspace_id=ws AND user_id=target;
  ELSE
   UPDATE public.team_invitations SET revoked_at=now() WHERE workspace_id=ws AND email=(SELECT email FROM public.users WHERE id=target) AND accepted_at IS NULL AND revoked_at IS NULL;
   DELETE FROM public.memberships WHERE workspace_id=ws AND user_id=target;
  END IF;
 ELSIF p_action='workspace' THEN
  IF actor_role<>'owner' THEN RAISE EXCEPTION 'team_permission';END IF;
  new_name:=trim(p_data->>'name');
  IF new_name IS NULL OR length(new_name) NOT BETWEEN 1 AND 150 OR(p_data->>'currency' IS NOT NULL AND p_data->>'currency'!~'^[A-Z]{3}$') OR length(coalesce(p_data->>'timezone',''))>100 OR(p_data->>'timezone' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_data->>'timezone')) THEN RAISE EXCEPTION 'team_input';END IF;
  UPDATE public.workspaces SET name=new_name,preferred_currency=p_data->>'currency',preferred_timezone=p_data->>'timezone' WHERE id=ws;
  INSERT INTO public.team_events(workspace_id,actor_id,action) VALUES(ws,actor,'workspace.updated');
 ELSIF p_action='profile' THEN
  new_name:=trim(p_data->>'name');new_hash:=p_data->>'password_hash';
  IF new_name IS NULL OR length(new_name) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'team_input';END IF;
  IF new_hash IS NOT NULL THEN
   IF new_hash!~'^[a-f0-9]{32}:[a-f0-9]{128}$' OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor AND password_hash=p_data->>'verified_password_hash') THEN RAISE EXCEPTION 'team_credentials';END IF;
   UPDATE public.users SET password_hash=new_hash WHERE id=actor;
   DELETE FROM public.sessions WHERE user_id=actor AND token_hash<>browser;
  END IF;
  UPDATE public.users SET name=new_name WHERE id=actor;
  INSERT INTO public.team_events(workspace_id,actor_id,action) VALUES(ws,actor,CASE WHEN new_hash IS NULL THEN 'profile.updated' ELSE 'profile.password_changed' END);
 ELSIF p_action='switch' THEN
  target_ws:=(p_data->>'workspace_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE workspace_id=target_ws AND user_id=actor) OR coalesce(p_data->>'token_hash','')!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'team_permission';END IF;
  INSERT INTO public.sessions(token_hash,user_id,workspace_id,expires_at) VALUES(p_data->>'token_hash',actor,target_ws,now()+interval '8 hours');
  DELETE FROM public.sessions WHERE token_hash=browser;
 ELSE RAISE EXCEPTION 'team_input';
 END IF;
 RETURN '{}'::jsonb;
END $$;

