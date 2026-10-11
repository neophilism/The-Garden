-- Additive geographic envelopes. No extension, live import or public grant.
SET LOCAL ROLE garden_migrator;
CREATE FUNCTION garden_control.validate_geographic_record() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE p jsonb:=NEW.payload; ref jsonb; target jsonb; c jsonb; k text:=p->>'recordType';
BEGIN
 IF TG_OP='UPDATE' AND OLD.payload->>'recordType'='geographic-assertion' THEN
  IF k IS DISTINCT FROM 'geographic-assertion' OR p->'subject' IS DISTINCT FROM OLD.payload->'subject'
   OR p->'context' IS DISTINCT FROM OLD.payload->'context' OR p->'sensitivity' IS DISTINCT FROM OLD.payload->'sensitivity'
   THEN RAISE EXCEPTION 'Geographic identity is immutable'; END IF;
 END IF;
 IF k IS DISTINCT FROM 'geographic-assertion' THEN RETURN NEW; END IF;
 IF p->>'id' IS DISTINCT FROM NEW.id::text OR p->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR octet_length(p::text)>131072
  OR NOT p ?& ARRAY['recordType','schemaVersion','id','subject','claim','evidence','crs','geometry','validDuring','uncertainty','context','sensitivity','names','rationale']
  OR p-ARRAY['recordType','schemaVersion','id','subject','claim','evidence','crs','geometry','validDuring','uncertainty','context','sensitivity','names','rationale']<>'{}'::jsonb
  OR p->>'crs' IS DISTINCT FROM 'OGC:CRS84' OR NOT garden_control.historical_temporal_valid(p->'validDuring')
  OR NOT garden_control.historical_text_valid(p->'rationale',4000,false)
  OR NOT COALESCE(p->>'context' IN ('historical-assertion','modern-reference'),false)
  OR NOT COALESCE(p->>'sensitivity' IN ('historical','living-person','sensitive-site'),false) THEN RAISE EXCEPTION 'Geographic shape'; END IF;
 IF p->>'sensitivity'<>'historical' AND NEW.classification<>'personal' THEN RAISE EXCEPTION 'Sensitive coordinates require a private case boundary'; END IF;
 IF NOT garden_control.claim_ref_valid((p->'subject')-'kind')
  OR NOT COALESCE(p#>>'{subject,kind}' IN ('place','port','polity','people','institution','person'),false)
  OR p#>>'{subject,kind}'='person' AND p->>'sensitivity'<>'living-person'
  OR p->>'context'='modern-reference' AND p#>>'{subject,kind}' NOT IN ('place','port')
  OR NOT garden_control.claim_ref_valid(p->'claim')
  OR p#>>'{subject,id}' IN (NEW.id::text,p#>>'{claim,id}') OR p#>>'{claim,id}'=NEW.id::text THEN RAISE EXCEPTION 'Geographic subject or claim'; END IF;
 SELECT payload INTO target FROM garden_private.record_revisions WHERE workspace_id=NEW.workspace_id AND record_id=(p#>>'{subject,id}')::uuid AND version=(p#>>'{subject,revision}')::bigint;
 IF NOT FOUND OR target->>'recordType' IS DISTINCT FROM 'entity' OR target->>'kind' IS DISTINCT FROM p#>>'{subject,kind}' OR target->'redirect' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Geographic subject unavailable'; END IF;
 SELECT payload INTO c FROM garden_private.record_revisions WHERE workspace_id=NEW.workspace_id AND record_id=(p#>>'{claim,id}')::uuid AND version=(p#>>'{claim,revision}')::bigint;
 IF NOT FOUND OR c->>'recordType' IS DISTINCT FROM 'claim' OR c->>'assertionType'='policy-statement' THEN RAISE EXCEPTION 'Geographic evidence unavailable'; END IF;
 IF jsonb_typeof(p->'evidence') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Geographic evidence shape'; END IF;
 IF jsonb_array_length(p->'evidence') NOT BETWEEN 1 AND 32 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'evidence') e GROUP BY e->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Geographic evidence bound'; END IF;
 FOR ref IN SELECT * FROM jsonb_array_elements(p->'evidence') LOOP
  IF NOT garden_control.claim_ref_valid(ref) OR ref->>'id' IN (NEW.id::text,p#>>'{subject,id}',p#>>'{claim,id}') THEN RAISE EXCEPTION 'Geographic evidence ref'; END IF;
  SELECT payload INTO target FROM garden_private.record_revisions WHERE workspace_id=NEW.workspace_id AND record_id=(ref->>'id')::uuid AND version=(ref->>'revision')::bigint;
  IF NOT FOUND OR target->>'recordType' IS DISTINCT FROM 'evidence-link' OR target->'claim' IS DISTINCT FROM p->'claim' THEN RAISE EXCEPTION 'Geographic evidence unavailable'; END IF;
 END LOOP;
 target:=p->'uncertainty';
 IF jsonb_typeof(target) IS DISTINCT FROM 'object' OR NOT target ?& ARRAY['kind','radiusMeters','description'] OR target-ARRAY['kind','radiusMeters','description']<>'{}'::jsonb
  OR NOT COALESCE(target->>'kind' IN ('reported-exact','approximate','disputed','unknown'),false)
  OR NOT garden_control.historical_text_valid(target->'description',2000,false)
  OR jsonb_typeof(target->'radiusMeters') NOT IN ('null','number') THEN RAISE EXCEPTION 'Geographic uncertainty required'; END IF;
 IF jsonb_typeof(target->'radiusMeters')='number' AND ((target->>'radiusMeters')::numeric<0 OR (target->>'radiusMeters')::numeric>20040000) THEN RAISE EXCEPTION 'Geographic radius bound'; END IF;
 IF p->'geometry'='null'::jsonb THEN
  IF target->>'kind'<>'unknown' OR target->'radiusMeters'<>'null'::jsonb THEN RAISE EXCEPTION 'Unknown geometry must remain unknown'; END IF;
 ELSE
  IF jsonb_typeof(p->'geometry') IS DISTINCT FROM 'object' OR NOT (p->'geometry') ?& ARRAY['type','coordinates'] OR (p->'geometry')-ARRAY['type','coordinates']<>'{}'::jsonb
   OR NOT COALESCE(p#>>'{geometry,type}' IN ('Point','LineString','Polygon','MultiPolygon'),false) OR jsonb_typeof(p#>'{geometry,coordinates}') IS DISTINCT FROM 'array'
   OR target->>'kind'='unknown' OR p#>>'{geometry,type}'<>'Point' AND target->'radiusMeters'<>'null'::jsonb THEN RAISE EXCEPTION 'Geographic geometry shape'; END IF;
 END IF;
 IF jsonb_typeof(p->'names') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'names')>100 THEN RAISE EXCEPTION 'Geographic names shape'; END IF;
 FOR ref IN SELECT * FROM jsonb_array_elements(p->'names') LOOP
  IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR NOT ref ?& ARRAY['value','language','validDuring'] OR ref-ARRAY['value','language','validDuring']<>'{}'::jsonb
   OR NOT garden_control.historical_text_valid(ref->'value',300,false) OR NOT garden_control.historical_text_valid(ref->'language',80,true)
   OR NOT garden_control.historical_temporal_valid(ref->'validDuring') THEN RAISE EXCEPTION 'Geographic historical name'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER geographic_shape BEFORE INSERT OR UPDATE ON garden_private.record_envelopes FOR EACH ROW EXECUTE FUNCTION garden_control.validate_geographic_record();
CREATE VIEW garden_private.geographic_assertions WITH(security_invoker=true,security_barrier=true) AS
 SELECT id,workspace_id,version,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='geographic-assertion';
GRANT SELECT ON garden_private.geographic_assertions TO garden_research;
REVOKE ALL ON FUNCTION garden_control.validate_geographic_record() FROM PUBLIC;

CREATE OR REPLACE FUNCTION garden_control.review_evidence_valid(p_workspace uuid,p_evidence jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE e jsonb; r garden_private.record_revisions%ROWTYPE; seen text[]:=ARRAY[]::text[]; k text;
BEGIN
 IF p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'array' OR jsonb_array_length(p_evidence)>32 OR octet_length(p_evidence::text)>8192 THEN RETURN false; END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(p_evidence) LOOP
  IF jsonb_typeof(e)<>'object' OR NOT e ?& ARRAY['recordId','revision'] OR e-ARRAY['recordId','revision']<>'{}'::jsonb OR
   jsonb_typeof(e->'recordId')<>'string' OR jsonb_typeof(e->'revision')<>'string' OR
   NOT COALESCE(e->>'recordId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) OR
   NOT COALESCE(e->>'revision' ~ '^[1-9][0-9]{0,18}$',false) OR (e->>'revision')::numeric>9223372036854775807 THEN RETURN false; END IF;
  k:=(e->>'recordId')||':'||(e->>'revision');IF k=ANY(seen) THEN RETURN false; END IF;seen:=seen||k;
  PERFORM garden_control.review_actor(p_workspace,(e->>'recordId')::uuid);
  SELECT * INTO r FROM garden_private.record_revisions WHERE workspace_id=p_workspace AND record_id=(e->>'recordId')::uuid AND version=(e->>'revision')::bigint;
  IF NOT FOUND OR NOT COALESCE(r.payload->>'recordType' IN ('entity','relationship','source','archival-unit','locator','claim','evidence-link','claim-placement','geographic-assertion'),false) THEN RETURN false; END IF;
 END LOOP; RETURN true;
END $$;

CREATE OR REPLACE FUNCTION garden_control.register_review_scope(p_workspace uuid,p_id uuid,p_record uuid,p_version bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE actor text; r garden_private.record_envelopes%ROWTYPE; v garden_private.record_revisions%ROWTYPE; old uuid; authors text[]; complete boolean; fingerprint text; initial jsonb;
BEGIN
 IF p_id IS NULL OR p_record IS NULL OR p_version IS NULL OR p_version<1 THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(p_workspace::text));
 actor:=garden_control.review_actor(p_workspace,p_record);PERFORM garden_control.review_role(p_workspace,actor,ARRAY['editor']);
 SELECT * INTO STRICT r FROM garden_private.record_envelopes WHERE workspace_id=p_workspace AND id=p_record;
 SELECT * INTO v FROM garden_private.record_revisions WHERE workspace_id=p_workspace AND record_id=p_record AND version=p_version;
 IF NOT FOUND OR NOT COALESCE(v.payload->>'recordType' IN ('entity','relationship','source','archival-unit','locator','claim','evidence-link','claim-placement','geographic-assertion'),false) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 SELECT id INTO old FROM garden_control.review_scopes WHERE workspace_id=p_workspace AND record_id=p_record AND record_version=p_version;
 IF FOUND THEN RETURN old; END IF;
 SELECT array_agg(s ORDER BY s) INTO authors FROM (SELECT DISTINCT actor_subject_id s FROM garden_private.record_revisions WHERE workspace_id=p_workspace AND record_id=p_record AND version<=p_version AND actor_subject_id IS NOT NULL UNION SELECT r.owner_subject_id) a;
 IF cardinality(authors)>256 THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 SELECT NOT EXISTS(SELECT 1 FROM garden_private.record_revisions WHERE workspace_id=p_workspace AND record_id=p_record AND version<=p_version AND payload<>'{}'::jsonb AND actor_subject_id IS NULL) INTO complete;
 fingerprint:=encode(sha256(convert_to(v.payload::text,'UTF8')),'hex');
 INSERT INTO garden_control.review_targets(workspace_id,target_id,revision_sha256,author_subject_id) VALUES(p_workspace,p_id,fingerprint,COALESCE(v.actor_subject_id,r.owner_subject_id));
 INSERT INTO garden_control.review_scopes(workspace_id,id,record_id,record_version,record_sha256,authors,authorship_complete,created_by) VALUES(p_workspace,p_id,p_record,p_version,fingerprint,authors,complete,actor);
 SELECT jsonb_object_agg(axis,rule->>'initial') INTO initial FROM garden_control.review_axis_rules WHERE version=1;
 INSERT INTO garden_control.status_snapshots(workspace_id,scope_id,states) VALUES(p_workspace,p_id,initial);
 PERFORM garden_control.append_audit_event(p_workspace,'subject',actor,'review',p_id::text,p_version,'review.scope');
 RETURN p_id;
END $$;

RESET ROLE;
