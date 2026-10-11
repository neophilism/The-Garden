-- Additive canonical history for typed research records. Not a signed audit log.
SET LOCAL ROLE garden_migrator;
CREATE TABLE garden_private.record_revisions (
 workspace_id uuid NOT NULL, record_id uuid NOT NULL, version bigint NOT NULL CHECK(version>0),
 payload jsonb NOT NULL, actor_subject_id text, changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,record_id,version),
 FOREIGN KEY(workspace_id,record_id) REFERENCES garden_private.record_envelopes(workspace_id,id)
);
REVOKE ALL ON garden_private.record_revisions FROM PUBLIC,garden_research,garden_context_issuer,garden_worker,garden_public,garden_publisher;
ALTER TABLE garden_private.record_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_private.record_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY revision_read ON garden_private.record_revisions FOR SELECT TO garden_research USING (
 EXISTS(SELECT 1 FROM garden_private.record_envelopes r WHERE r.id=record_id AND r.workspace_id=record_revisions.workspace_id)
);
CREATE POLICY revision_append ON garden_private.record_revisions FOR INSERT TO garden_migrator WITH CHECK(true);
GRANT SELECT ON garden_private.record_revisions TO garden_research;
CREATE FUNCTION garden_control.append_record_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE actor text;
BEGIN
 SELECT t.subject_id INTO actor FROM garden_control.policy_contexts c JOIN garden_control.policy_tickets t ON t.token_hash=c.token_hash
 WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned();
 INSERT INTO garden_private.record_revisions(workspace_id,record_id,version,payload,actor_subject_id)
 VALUES(NEW.workspace_id,NEW.id,NEW.version,NEW.payload,actor);
 RETURN NEW;
END $$;
CREATE TRIGGER record_history AFTER INSERT OR UPDATE ON garden_private.record_envelopes FOR EACH ROW EXECUTE FUNCTION garden_control.append_record_revision();
CREATE FUNCTION garden_control.historical_provenance_valid(p jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN p IS NULL OR jsonb_typeof(p)<>'array' THEN false ELSE
 jsonb_array_length(p)<=100 AND NOT EXISTS(
 SELECT 1 FROM jsonb_array_elements(p) e WHERE jsonb_typeof(e)<>'object' OR NOT e ?& ARRAY['sourceId','locator']
 OR e - ARRAY['sourceId','locator']<>'{}'::jsonb
 OR NOT COALESCE(e->>'sourceId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
 OR jsonb_typeof(e->'locator')<>'string' OR length(btrim(e->>'locator'))=0 OR length(e->>'locator')>1000) END
$$;
CREATE FUNCTION garden_control.historical_text_valid(p jsonb,bound integer,nullable boolean) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT COALESCE((nullable AND p='null'::jsonb) OR (jsonb_typeof(p)='string' AND length(btrim(p#>>'{}'))>0 AND length(p#>>'{}')<=bound),false)
$$;
CREATE FUNCTION garden_control.historical_temporal_valid(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE field text; value jsonb;
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR NOT p ?& ARRAY['verbatim','earliestYear','latestYear','calendar'] OR p - ARRAY['verbatim','earliestYear','latestYear','calendar']<>'{}'::jsonb THEN RETURN false; END IF;
 IF NOT garden_control.historical_text_valid(p->'verbatim',500,true) OR NOT garden_control.historical_text_valid(p->'calendar',80,true) THEN RETURN false; END IF;
 FOREACH field IN ARRAY ARRAY['earliestYear','latestYear'] LOOP
  value:=p->field;
  IF value<>'null'::jsonb THEN
   IF jsonb_typeof(value)<>'number' OR (value#>>'{}') !~ '^-?[0-9]+$' THEN RETURN false; END IF;
   IF (value#>>'{}')::numeric NOT BETWEEN -999999 AND 999999 OR p->'verbatim'='null'::jsonb THEN RETURN false; END IF;
  END IF;
 END LOOP;
 IF p->'earliestYear'<>'null'::jsonb AND p->'latestYear'<>'null'::jsonb AND (p->>'earliestYear')::numeric>(p->>'latestYear')::numeric THEN RETURN false; END IF;
 RETURN true;
END $$;
CREATE FUNCTION garden_control.validate_historical_record() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE p jsonb:=NEW.payload; old_type text; k text; target garden_private.record_envelopes%ROWTYPE; n jsonb; ref jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN
  old_type:=OLD.payload->>'recordType';
  IF old_type IN ('entity','relationship') AND (p->>'recordType') IS DISTINCT FROM old_type THEN RAISE EXCEPTION 'Historical record type is immutable'; END IF;
 END IF;
 IF NOT COALESCE(p->>'recordType' IN ('entity','relationship'),false) THEN RETURN NEW; END IF;
 IF p->>'id' IS DISTINCT FROM NEW.id::text OR p->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR octet_length(p::text)>262144 THEN RAISE EXCEPTION 'Historical record identity or size'; END IF;
 IF NOT garden_control.historical_temporal_valid(p->'temporal') OR NOT garden_control.historical_text_valid(p->'title',300,true) THEN RAISE EXCEPTION 'Historical time is explicit'; END IF;
 IF p->>'recordType'='entity' THEN
  k:=p->>'kind';
  IF k IS NULL OR k NOT IN ('person','polity','people','language','place','port','institution','voyage','event')
   OR NOT p ?& ARRAY['recordType','schemaVersion','id','kind','title','summary','names','sourceIdentities','temporal','redirect']
   OR p - ARRAY['recordType','schemaVersion','id','kind','title','summary','names','sourceIdentities','temporal','redirect']<>'{}'::jsonb
   OR jsonb_typeof(p->'names') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'sourceIdentities') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Historical entity shape'; END IF;
  IF NOT garden_control.historical_text_valid(p->'summary',4000,true) THEN RAISE EXCEPTION 'Historical summary'; END IF;
  IF jsonb_array_length(p->'names')>200 OR jsonb_array_length(p->'sourceIdentities')>200 THEN RAISE EXCEPTION 'Historical list bound'; END IF;
  FOR n IN SELECT * FROM jsonb_array_elements(p->'names') LOOP
   IF jsonb_typeof(n) IS DISTINCT FROM 'object' OR NOT n ?& ARRAY['id','value','language','script','usage','provenance']
    OR n - ARRAY['id','value','language','script','usage','provenance']<>'{}'::jsonb
    OR NOT COALESCE(n->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
    OR jsonb_typeof(n->'value') IS DISTINCT FROM 'string' OR length(btrim(n->>'value'))=0 OR length(n->>'value')>300
    OR NOT COALESCE(n->>'usage' IN ('historical','preferred','alternate','catalogued'),false)
    OR NOT garden_control.historical_text_valid(n->'language',80,true) OR NOT garden_control.historical_text_valid(n->'script',80,true)
    OR NOT garden_control.historical_provenance_valid(n->'provenance') THEN RAISE EXCEPTION 'Historical name shape'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'names') e GROUP BY e->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate historical name identity'; END IF;
  FOR ref IN SELECT * FROM jsonb_array_elements(p->'sourceIdentities') LOOP
   IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR NOT ref ?& ARRAY['namespace','identifier'] OR ref - ARRAY['namespace','identifier']<>'{}'::jsonb
    OR jsonb_typeof(ref->'namespace') IS DISTINCT FROM 'string' OR jsonb_typeof(ref->'identifier') IS DISTINCT FROM 'string'
    OR length(btrim(ref->>'namespace'))=0 OR length(btrim(ref->>'identifier'))=0 THEN RAISE EXCEPTION 'Historical source identity'; END IF;
  END LOOP;
  IF old_type='entity' AND (OLD.payload->>'kind' IS DISTINCT FROM k OR NOT (p->'sourceIdentities') @> (OLD.payload->'sourceIdentities')) THEN RAISE EXCEPTION 'Historical identity preservation'; END IF;
  IF p->'redirect' IS DISTINCT FROM 'null'::jsonb THEN
   ref:=p->'redirect';
   IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR NOT ref ?& ARRAY['targetId','reason','evidence'] OR ref - ARRAY['targetId','reason','evidence']<>'{}'::jsonb
    OR NOT COALESCE(ref->>'targetId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
    OR jsonb_typeof(ref->'reason') IS DISTINCT FROM 'string' OR length(btrim(ref->>'reason'))=0
    OR NOT garden_control.historical_text_valid(ref->'reason',2000,false) OR NOT garden_control.historical_provenance_valid(ref->'evidence') THEN RAISE EXCEPTION 'Historical merge decision'; END IF;
   IF jsonb_array_length(ref->'evidence')=0 OR ref->>'targetId'=NEW.id::text THEN RAISE EXCEPTION 'Historical merge evidence'; END IF;
   IF old_type IS DISTINCT FROM 'entity' OR OLD.payload->'redirect' IS DISTINCT FROM ref THEN
    IF old_type='entity' AND OLD.payload->'redirect' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Unmerge before changing destination'; END IF;
    SELECT * INTO target FROM garden_private.record_envelopes WHERE workspace_id=NEW.workspace_id AND id=(ref->>'targetId')::uuid FOR UPDATE;
    IF NOT FOUND OR target.payload->>'recordType' IS DISTINCT FROM 'entity' OR target.payload->>'kind' IS DISTINCT FROM k OR target.payload->'redirect' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Historical merge target'; END IF;
    IF current_user='garden_research' AND NOT garden_control.may_access_record(target.workspace_id,target.id,target.classification,target.state,'write') THEN RAISE EXCEPTION 'Historical target authorization'; END IF;
   END IF;
  END IF;
 ELSE
  IF NOT p ?& ARRAY['recordType','schemaVersion','id','title','predicate','fromId','fromKind','toId','toKind','assessment','explanation','evidence','temporal']
   OR p - ARRAY['recordType','schemaVersion','id','title','predicate','fromId','fromKind','toId','toKind','assessment','explanation','evidence','temporal']<>'{}'::jsonb
   OR NOT garden_control.historical_text_valid(p->'explanation',4000,false) OR NOT COALESCE(p->>'assessment' IN ('unreviewed','contested'),false) OR NOT garden_control.historical_provenance_valid(p->'evidence') THEN RAISE EXCEPTION 'Historical relationship shape'; END IF;
  IF p->>'fromId'=p->>'toId' OR NEW.id::text IN (p->>'fromId',p->>'toId') THEN RAISE EXCEPTION 'Historical relationship self reference'; END IF;
  FOR n IN SELECT jsonb_build_object('id',p->>'fromId','kind',p->>'fromKind') UNION ALL SELECT jsonb_build_object('id',p->>'toId','kind',p->>'toKind') LOOP
   SELECT * INTO target FROM garden_private.record_envelopes WHERE workspace_id=NEW.workspace_id AND id=(n->>'id')::uuid;
   IF NOT FOUND OR target.payload->>'recordType' IS DISTINCT FROM 'entity' OR target.payload->>'kind' IS DISTINCT FROM n->>'kind' THEN RAISE EXCEPTION 'Historical relationship endpoint'; END IF;
  END LOOP;
  IF NOT COALESCE(CASE p->>'predicate'
   WHEN 'located_in' THEN p->>'fromKind'<>'language' AND p->>'toKind'='place'
   WHEN 'used_language' THEN p->>'fromKind' IN ('person','people','polity','institution') AND p->>'toKind'='language'
   WHEN 'member_of' THEN p->>'fromKind'='person' AND p->>'toKind' IN ('people','polity','institution')
   WHEN 'participated_in' THEN p->>'fromKind' IN ('person','people','polity','institution') AND p->>'toKind' IN ('event','voyage')
   WHEN 'departed_from' THEN p->>'fromKind'='voyage' AND p->>'toKind' IN ('place','port')
   WHEN 'arrived_at' THEN p->>'fromKind'='voyage' AND p->>'toKind' IN ('place','port')
   WHEN 'succeeded_by' THEN p->>'fromKind' IN ('polity','institution') AND p->>'fromKind'=p->>'toKind'
   WHEN 'related_to' THEN true ELSE false END,false) THEN RAISE EXCEPTION 'Historical relationship types'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER historical_shape BEFORE INSERT OR UPDATE ON garden_private.record_envelopes FOR EACH ROW EXECUTE FUNCTION garden_control.validate_historical_record();
CREATE VIEW garden_private.entities WITH(security_invoker=true,security_barrier=true) AS
 SELECT id,workspace_id,version,payload->>'kind' AS kind,payload->'temporal' AS temporal,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='entity';
CREATE VIEW garden_private.names WITH(security_invoker=true,security_barrier=true) AS
 SELECT r.id AS entity_id,r.workspace_id,r.version,n AS name FROM garden_private.record_envelopes r CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN r.payload->>'recordType'='entity' THEN r.payload->'names' ELSE '[]'::jsonb END) n;
CREATE VIEW garden_private.relationship_assertions WITH(security_invoker=true,security_barrier=true) AS
 SELECT id,workspace_id,version,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='relationship';
CREATE VIEW garden_private.redirects WITH(security_invoker=true,security_barrier=true) AS
 SELECT id AS source_id,workspace_id,version,payload->'redirect' AS decision FROM garden_private.record_envelopes WHERE payload->>'recordType'='entity' AND payload->'redirect'<>'null'::jsonb;
GRANT SELECT ON garden_private.entities,garden_private.names,garden_private.relationship_assertions,garden_private.redirects TO garden_research;
REVOKE ALL ON FUNCTION garden_control.append_record_revision(),garden_control.historical_provenance_valid(jsonb),garden_control.historical_text_valid(jsonb,integer,boolean),garden_control.historical_temporal_valid(jsonb),garden_control.validate_historical_record() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.historical_provenance_valid(jsonb),garden_control.historical_text_valid(jsonb,integer,boolean),garden_control.historical_temporal_valid(jsonb) TO garden_research;
RESET ROLE;
