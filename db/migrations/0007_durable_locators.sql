-- Hash- and version-bound locators. Immutable proposals do not authorize publication.
SET LOCAL ROLE garden_migrator;
CREATE FUNCTION garden_control.exact_revision_valid(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'string' OR NOT COALESCE(p#>>'{}' ~ '^[1-9][0-9]{0,18}$',false) THEN RETURN false; END IF;
 RETURN (p#>>'{}')::numeric<=9223372036854775807;
END $$;
CREATE FUNCTION garden_control.locator_integer(p jsonb,minimum numeric,maximum numeric) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'number' OR NOT COALESCE(p#>>'{}' ~ '^[0-9]+$',false) THEN RETURN false; END IF;
 RETURN (p#>>'{}')::numeric BETWEEN minimum AND maximum;
END $$;
CREATE FUNCTION garden_control.validate_durable_locator() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE p jsonb:=NEW.payload; s jsonb; q jsonb; part jsonb; target jsonb; field text; old_kind text; ref_id uuid;
BEGIN
 IF TG_OP='UPDATE' THEN
  old_kind:=OLD.payload->>'recordType';
  IF old_kind IN ('locator','locator-reanchor') AND OLD.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'Locator records are immutable; create an explicit replacement proposal'; END IF;
 END IF;
 IF NOT COALESCE(p->>'recordType' IN ('locator','locator-reanchor'),false) THEN RETURN NEW; END IF;
 IF p->>'id' IS DISTINCT FROM NEW.id::text OR p->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR octet_length(p::text)>131072 THEN RAISE EXCEPTION 'Locator identity or bound'; END IF;
 IF p->>'recordType'='locator-reanchor' THEN
  IF NOT p ?& ARRAY['recordType','schemaVersion','id','fromLocatorId','toLocatorId','reason','decision'] OR p-ARRAY['recordType','schemaVersion','id','fromLocatorId','toLocatorId','reason','decision']<>'{}'::jsonb OR p->>'decision' IS DISTINCT FROM 'proposed'
   OR NOT garden_control.historical_text_valid(p->'reason',2000,false) OR p->>'fromLocatorId'=p->>'toLocatorId' OR NEW.id::text IN (p->>'fromLocatorId',p->>'toLocatorId') THEN RAISE EXCEPTION 'Reanchor proposal shape'; END IF;
  FOREACH field IN ARRAY ARRAY['fromLocatorId','toLocatorId'] LOOP
   IF NOT COALESCE(p->>field ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) THEN RAISE EXCEPTION 'Reanchor reference'; END IF;
   SELECT payload INTO target FROM garden_private.record_envelopes WHERE workspace_id=NEW.workspace_id AND id=(p->>field)::uuid;
   IF NOT FOUND OR target->>'recordType' IS DISTINCT FROM 'locator' THEN RAISE EXCEPTION 'Reanchor locator unavailable'; END IF;
  END LOOP;
  RETURN NEW;
 END IF;
 IF NOT p ?& ARRAY['recordType','schemaVersion','id','source','resourceSha256','originalIdentifiers','page','selector','description'] OR p-ARRAY['recordType','schemaVersion','id','source','resourceSha256','originalIdentifiers','page','selector','description']<>'{}'::jsonb
  OR NOT garden_control.historical_text_valid(p->'description',1000,true)
  OR jsonb_typeof(p->'resourceSha256') IS DISTINCT FROM 'string' OR NOT COALESCE(p->>'resourceSha256' ~ '^[0-9a-f]{64}$',false) THEN RAISE EXCEPTION 'Locator shape'; END IF;
 q:=p->'source';
 IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT q ?& ARRAY['id','revision'] OR q-ARRAY['id','revision']<>'{}'::jsonb
  OR NOT COALESCE(q->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
  OR NOT garden_control.exact_revision_valid(q->'revision') OR q->>'id'=NEW.id::text THEN RAISE EXCEPTION 'Exact source version required'; END IF;
 SELECT payload INTO target FROM garden_private.record_revisions WHERE workspace_id=NEW.workspace_id AND record_id=(q->>'id')::uuid AND version=(q->>'revision')::bigint;
 IF NOT FOUND OR target->>'recordType' IS DISTINCT FROM 'source' OR target->>'form' IS DISTINCT FROM 'digital-representation' OR target->'representation'->>'sha256' IS DISTINCT FROM p->>'resourceSha256' THEN RAISE EXCEPTION 'Exact source bytes unavailable'; END IF;
 IF p#>>'{selector,type}'='image' AND NOT (target#>>'{representation,mediaType}' LIKE 'image/%' OR target#>>'{representation,mediaType}'='application/pdf' AND p->'page'<>'null'::jsonb) THEN RAISE EXCEPTION 'Image selector requires an image or a specific PDF page'; END IF;
 IF p#>>'{selector,type}'='time' AND NOT (target#>>'{representation,mediaType}' ~ '^(audio|video)/') THEN RAISE EXCEPTION 'Time selector requires timed media'; END IF;
 q:=p->'originalIdentifiers';
 IF jsonb_typeof(q) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Original identifier list'; END IF;
 IF jsonb_array_length(q)>32 OR EXISTS(SELECT 1 FROM jsonb_array_elements(q) e GROUP BY e->>'namespace',e->>'identifier' HAVING count(*)>1) THEN RAISE EXCEPTION 'Identifier list bound'; END IF;
 FOR part IN SELECT * FROM jsonb_array_elements(q) LOOP
  IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR NOT part ?& ARRAY['namespace','identifier'] OR part-ARRAY['namespace','identifier']<>'{}'::jsonb
   OR NOT garden_control.historical_text_valid(part->'namespace',300,false) OR NOT garden_control.historical_text_valid(part->'identifier',1000,false) THEN RAISE EXCEPTION 'Original identifier shape'; END IF;
 END LOOP;
 q:=p->'page';
 IF q IS DISTINCT FROM 'null'::jsonb THEN
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT q ?& ARRAY['ordinal','label','canvasId'] OR q-ARRAY['ordinal','label','canvasId']<>'{}'::jsonb OR NOT garden_control.locator_integer(q->'ordinal',0,1000000)
   OR NOT garden_control.historical_text_valid(q->'label',200,true) OR NOT garden_control.historical_text_valid(q->'canvasId',1000,true) THEN RAISE EXCEPTION 'Page ordinal and printed label are separate'; END IF;
 END IF;
 s:=p->'selector';
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Locator selector required'; END IF;
 CASE s->>'type'
 WHEN 'whole' THEN
  IF s<>'{"type":"whole"}'::jsonb THEN RAISE EXCEPTION 'Whole selector shape'; END IF;
 WHEN 'text' THEN
  IF NOT s ?& ARRAY['type','profile','textSha256','position','quote'] OR s-ARRAY['type','profile','textSha256','position','quote']<>'{}'::jsonb OR s->>'profile' IS DISTINCT FROM 'plain-text-codepoints-v1'
   OR jsonb_typeof(s->'textSha256') IS DISTINCT FROM 'string' OR NOT COALESCE(s->>'textSha256' ~ '^[0-9a-f]{64}$',false) OR (s->'position'='null'::jsonb AND s->'quote'='null'::jsonb) THEN RAISE EXCEPTION 'Text selector shape'; END IF;
  q:=s->'position';
  IF q IS DISTINCT FROM 'null'::jsonb THEN
   IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT q ?& ARRAY['start','end'] OR q-ARRAY['start','end']<>'{}'::jsonb OR NOT garden_control.locator_integer(q->'start',0,9007199254740991) OR NOT garden_control.locator_integer(q->'end',1,9007199254740991) THEN RAISE EXCEPTION 'Text position shape'; END IF;
   IF (q->>'start')::numeric>=(q->>'end')::numeric THEN RAISE EXCEPTION 'Half-open text position'; END IF;
  END IF;
  q:=s->'quote';
  IF q IS DISTINCT FROM 'null'::jsonb THEN
   IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT q ?& ARRAY['exact','prefix','suffix'] OR q-ARRAY['exact','prefix','suffix']<>'{}'::jsonb OR NOT garden_control.historical_text_valid(q->'exact',2000,false)
    OR jsonb_typeof(q->'prefix') IS DISTINCT FROM 'string' OR jsonb_typeof(q->'suffix') IS DISTINCT FROM 'string' OR length(q->>'prefix')>256 OR length(q->>'suffix')>256 THEN RAISE EXCEPTION 'Text quote shape'; END IF;
  END IF;
 WHEN 'image' THEN
  IF NOT s ?& ARRAY['type','unit','x','y','width','height','canvasWidth','canvasHeight'] OR s-ARRAY['type','unit','x','y','width','height','canvasWidth','canvasHeight']<>'{}'::jsonb OR s->>'unit' IS DISTINCT FROM 'pixel' THEN RAISE EXCEPTION 'Image selector shape'; END IF;
  FOREACH field IN ARRAY ARRAY['x','y'] LOOP IF NOT garden_control.locator_integer(s->field,0,1000000) THEN RAISE EXCEPTION 'Pixel origin'; END IF; END LOOP;
  FOREACH field IN ARRAY ARRAY['width','height','canvasWidth','canvasHeight'] LOOP IF NOT garden_control.locator_integer(s->field,1,1000000) THEN RAISE EXCEPTION 'Pixel extent'; END IF; END LOOP;
  IF (s->>'x')::numeric+(s->>'width')::numeric>(s->>'canvasWidth')::numeric OR (s->>'y')::numeric+(s->>'height')::numeric>(s->>'canvasHeight')::numeric THEN RAISE EXCEPTION 'Image selector exceeds original canvas'; END IF;
 WHEN 'time' THEN
  IF NOT s ?& ARRAY['type','startMs','endMs','durationMs'] OR s-ARRAY['type','startMs','endMs','durationMs']<>'{}'::jsonb OR NOT garden_control.locator_integer(s->'startMs',0,9007199254740991) THEN RAISE EXCEPTION 'Time selector shape'; END IF;
  FOREACH field IN ARRAY ARRAY['endMs','durationMs'] LOOP IF NOT garden_control.locator_integer(s->field,1,9007199254740991) THEN RAISE EXCEPTION 'Time extent'; END IF; END LOOP;
  IF (s->>'startMs')::numeric>=(s->>'endMs')::numeric OR (s->>'endMs')::numeric>(s->>'durationMs')::numeric THEN RAISE EXCEPTION 'Time interval outside exact media'; END IF;
 ELSE RAISE EXCEPTION 'Unsupported locator selector';
 END CASE;
 RETURN NEW;
END $$;
CREATE TRIGGER locator_shape BEFORE INSERT OR UPDATE ON garden_private.record_envelopes FOR EACH ROW EXECUTE FUNCTION garden_control.validate_durable_locator();
CREATE VIEW garden_private.locators WITH(security_invoker=true,security_barrier=true) AS SELECT id,workspace_id,version,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='locator';
CREATE VIEW garden_private.reanchor_proposals WITH(security_invoker=true,security_barrier=true) AS SELECT id,workspace_id,version,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='locator-reanchor';
GRANT SELECT ON garden_private.locators,garden_private.reanchor_proposals TO garden_research;
REVOKE ALL ON FUNCTION garden_control.exact_revision_valid(jsonb),garden_control.locator_integer(jsonb,numeric,numeric),garden_control.validate_durable_locator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.exact_revision_valid(jsonb),garden_control.locator_integer(jsonb,numeric,numeric) TO garden_research;
RESET ROLE;
