-- Additive, version-bound claims and placements. No review/publication state is granted.
SET LOCAL ROLE garden_migrator;
CREATE FUNCTION garden_control.claim_ref_valid(p jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT COALESCE(jsonb_typeof(p)='object' AND p ?& ARRAY['id','revision'] AND p-ARRAY['id','revision']='{}'::jsonb
 AND jsonb_typeof(p->'id')='string' AND p->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 AND garden_control.exact_revision_valid(p->'revision'),false)
$$;
CREATE FUNCTION garden_control.claim_dependency_ids(p jsonb) RETURNS uuid[]
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE refs jsonb:='[]'::jsonb; item jsonb; value text; ids uuid[]:='{}'::uuid[];
BEGIN
 CASE p->>'recordType'
 WHEN 'claim' THEN refs:=jsonb_build_array(p#>'{attribution,locatorId}');
 WHEN 'evidence-link' THEN refs:=jsonb_build_array(p#>'{claim,id}',p->'locatorId');
 WHEN 'claim-placement' THEN
  IF jsonb_typeof(p->'dependencies')='array' THEN
   FOR item IN SELECT * FROM jsonb_array_elements(p->'dependencies') LOOP refs:=refs||jsonb_build_array(item->'id'); END LOOP;
  END IF;
 WHEN 'locator' THEN refs:=jsonb_build_array(p#>'{source,id}');
 WHEN 'source' THEN refs:=CASE WHEN jsonb_typeof(p->'derivedFrom')='array' THEN p->'derivedFrom' ELSE '[]'::jsonb END||jsonb_build_array(p->'archivalItemId');
 WHEN 'archival-unit' THEN refs:=jsonb_build_array(p->'parentId');
 ELSE RETURN ids;
 END CASE;
 FOR item IN SELECT * FROM jsonb_array_elements(refs) LOOP
  value:=item#>>'{}';
  IF jsonb_typeof(item)='string' AND value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND NOT value::uuid=ANY(ids) THEN ids:=array_append(ids,value::uuid); END IF;
 END LOOP;
 RETURN ids;
END $$;
CREATE FUNCTION garden_control.validate_claim_record() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE p jsonb:=NEW.payload; q jsonb; part jsonb; target jsonb; kind text:=p->>'recordType'; old_kind text; refs jsonb:='[]'::jsonb; locators uuid[]:='{}'::uuid[]; loc uuid; field text;
BEGIN
 IF TG_OP='UPDATE' THEN
  old_kind:=OLD.payload->>'recordType';
  IF old_kind IN ('claim','evidence-link','claim-placement') AND kind IS DISTINCT FROM old_kind THEN RAISE EXCEPTION 'Claim record type is immutable'; END IF;
  IF old_kind='claim' AND OLD.payload->>'assertionType' IS DISTINCT FROM p->>'assertionType' THEN RAISE EXCEPTION 'Testimony and conclusions cannot be converted'; END IF;
  IF old_kind IN ('evidence-link','claim-placement') AND OLD.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'Evidence links and placements are immutable'; END IF;
 END IF;
 IF NOT COALESCE(kind IN ('claim','evidence-link','claim-placement'),false) THEN RETURN NEW; END IF;
 IF p->>'id' IS DISTINCT FROM NEW.id::text OR p->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR octet_length(p::text)>131072 THEN RAISE EXCEPTION 'Claim identity or bound'; END IF;
 IF kind='claim' THEN
  IF NOT p ?& ARRAY['recordType','schemaVersion','id','assertionType','proposition','wording','attribution','notes'] OR p-ARRAY['recordType','schemaVersion','id','assertionType','proposition','wording','attribution','notes']<>'{}'::jsonb
   OR NOT COALESCE(p->>'assertionType' IN ('source-testimony','historical-interpretation','policy-statement'),false)
   OR NOT garden_control.historical_text_valid(p->'wording',4000,false) OR NOT garden_control.historical_text_valid(p->'notes',2000,true) THEN RAISE EXCEPTION 'Claim shape'; END IF;
  q:=p->'proposition';
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT q ?& ARRAY['subject','predicate','object'] OR q-ARRAY['subject','predicate','object']<>'{}'::jsonb
   OR NOT garden_control.historical_text_valid(q->'subject',500,false) OR NOT garden_control.historical_text_valid(q->'predicate',200,false) OR NOT garden_control.historical_text_valid(q->'object',1500,false) THEN RAISE EXCEPTION 'One explicit structured proposition is required'; END IF;
  q:=p->'attribution';
  IF p->>'assertionType'='source-testimony' THEN
   IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT q ?& ARRAY['locatorId','agentLabel'] OR q-ARRAY['locatorId','agentLabel']<>'{}'::jsonb
    OR jsonb_typeof(q->'locatorId') IS DISTINCT FROM 'string' OR NOT COALESCE(q->>'locatorId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
    OR NOT garden_control.historical_text_valid(q->'agentLabel',500,true) THEN RAISE EXCEPTION 'Testimony requires precise attribution'; END IF;
   locators:=array_append(locators,(q->>'locatorId')::uuid);
  ELSIF q IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Interpretations use explicit evidence links'; END IF;
 ELSIF kind='evidence-link' THEN
  IF NOT p ?& ARRAY['recordType','schemaVersion','id','claim','locatorId','relation','rationale'] OR p-ARRAY['recordType','schemaVersion','id','claim','locatorId','relation','rationale']<>'{}'::jsonb
   OR NOT garden_control.claim_ref_valid(p->'claim') OR NOT COALESCE(p->>'relation' IN ('supports','contradicts','contextualizes'),false)
   OR NOT garden_control.historical_text_valid(p->'rationale',4000,false) OR jsonb_typeof(p->'locatorId') IS DISTINCT FROM 'string'
   OR NOT COALESCE(p->>'locatorId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
   OR p->>'locatorId'=p#>>'{claim,id}' THEN RAISE EXCEPTION 'Evidence edge requires a locator and explicit relation'; END IF;
  refs:=jsonb_build_array(p->'claim');locators:=array_append(locators,(p->>'locatorId')::uuid);
 ELSE
  IF NOT p ?& ARRAY['recordType','schemaVersion','id','target','dependencies'] OR p-ARRAY['recordType','schemaVersion','id','target','dependencies']<>'{}'::jsonb THEN RAISE EXCEPTION 'Placement shape'; END IF;
  q:=p->'target';
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT q ?& ARRAY['kind','identifier','version','language'] OR q-ARRAY['kind','identifier','version','language']<>'{}'::jsonb
   OR NOT COALESCE(q->>'kind' IN ('webpage','exhibit','translation','chart','book','social-graphic','assistant-context','download'),false)
   OR NOT garden_control.historical_text_valid(q->'identifier',1200,false) OR NOT garden_control.historical_text_valid(q->'version',300,false) OR NOT garden_control.historical_text_valid(q->'language',80,true) THEN RAISE EXCEPTION 'Placement must identify an exact artifact version'; END IF;
  refs:=p->'dependencies';
  IF jsonb_typeof(refs) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Placement dependencies required'; END IF;
  IF jsonb_array_length(refs) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(refs) e GROUP BY e->>'id',e->>'revision' HAVING count(*)>1) THEN RAISE EXCEPTION 'Placement dependency bound or duplicate'; END IF;
 END IF;
 FOR part IN SELECT * FROM jsonb_array_elements(refs) LOOP
  IF NOT garden_control.claim_ref_valid(part) OR part->>'id'=NEW.id::text THEN RAISE EXCEPTION 'Version-bound non-self dependency required'; END IF;
  SELECT payload INTO target FROM garden_private.record_revisions WHERE workspace_id=NEW.workspace_id AND record_id=(part->>'id')::uuid AND version=(part->>'revision')::bigint;
  IF NOT FOUND OR NOT COALESCE(target->>'recordType' IN ('claim','evidence-link','claim-placement'),false) OR (kind='evidence-link' AND target->>'recordType' IS DISTINCT FROM 'claim') THEN RAISE EXCEPTION 'Claim dependency unavailable'; END IF;
 END LOOP;
 FOREACH loc IN ARRAY locators LOOP
  IF loc=NEW.id THEN RAISE EXCEPTION 'Self attribution forbidden'; END IF;
  SELECT payload INTO target FROM garden_private.record_envelopes WHERE workspace_id=NEW.workspace_id AND id=loc;
  IF NOT FOUND OR target->>'recordType' IS DISTINCT FROM 'locator' THEN RAISE EXCEPTION 'Attribution locator unavailable'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER claim_shape BEFORE INSERT OR UPDATE ON garden_private.record_envelopes FOR EACH ROW EXECUTE FUNCTION garden_control.validate_claim_record();
CREATE INDEX claim_reverse_dependencies ON garden_private.record_envelopes USING gin(garden_control.claim_dependency_ids(payload));
CREATE VIEW garden_private.claims WITH(security_invoker=true,security_barrier=true) AS SELECT id,workspace_id,version,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='claim';
CREATE VIEW garden_private.evidence_links WITH(security_invoker=true,security_barrier=true) AS SELECT id,workspace_id,version,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='evidence-link';
CREATE VIEW garden_private.claim_placements WITH(security_invoker=true,security_barrier=true) AS SELECT id,workspace_id,version,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='claim-placement';
GRANT SELECT ON garden_private.claims,garden_private.evidence_links,garden_private.claim_placements TO garden_research;
REVOKE ALL ON FUNCTION garden_control.claim_ref_valid(jsonb),garden_control.claim_dependency_ids(jsonb),garden_control.validate_claim_record() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.claim_ref_valid(jsonb),garden_control.claim_dependency_ids(jsonb) TO garden_research;
RESET ROLE;
