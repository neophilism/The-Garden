-- Explicit archival levels, source forms and guarded derivation graphs.
SET LOCAL ROLE garden_migrator;
CREATE FUNCTION garden_control.catalog_assertions_valid(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE a jsonb; previous jsonb; next_id text; seen text[];
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p)>200 THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p) e GROUP BY e->>'id' HAVING count(*)>1) THEN RETURN false; END IF;
 FOR a IN SELECT * FROM jsonb_array_elements(p) LOOP
  IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR NOT a ?& ARRAY['id','field','value','provenance','supersedes'] OR a-ARRAY['id','field','value','provenance','supersedes']<>'{}'::jsonb
   OR NOT COALESCE(a->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
   OR NOT COALESCE(a->>'field' IN ('title','date','creator','call-number','language','extent','description'),false)
   OR NOT garden_control.historical_text_valid(a->'value',4000,false) OR NOT garden_control.historical_provenance_valid(a->'provenance') THEN RETURN false; END IF;
  next_id:=a->>'supersedes';seen:=ARRAY[a->>'id'];
  WHILE next_id IS NOT NULL LOOP
   IF next_id=ANY(seen) THEN RETURN false; END IF;
   SELECT e INTO previous FROM jsonb_array_elements(p) e WHERE e->>'id'=next_id;
   IF NOT FOUND OR previous->>'field' IS DISTINCT FROM a->>'field' THEN RETURN false; END IF;
   seen:=array_append(seen,next_id);next_id:=previous->>'supersedes';
  END LOOP;
 END LOOP;
 RETURN true;
END $$;
CREATE FUNCTION garden_control.source_edges(p jsonb) RETURNS uuid[]
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE ids uuid[]:=ARRAY[]::uuid[]; v text;
BEGIN
 IF p->>'recordType'='archival-unit' THEN
  IF p->>'parentId' IS NOT NULL THEN ids:=array_append(ids,(p->>'parentId')::uuid); END IF;
 ELSIF p->>'recordType'='source' THEN
  IF p->>'archivalItemId' IS NOT NULL THEN ids:=array_append(ids,(p->>'archivalItemId')::uuid); END IF;
  FOR v IN SELECT jsonb_array_elements_text(p->'derivedFrom') LOOP ids:=array_append(ids,v::uuid); END LOOP;
 END IF;
 RETURN ids;
END $$;
CREATE FUNCTION garden_control.validate_source_record() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE p jsonb:=NEW.payload; old_kind text; target jsonb; r jsonb; q uuid[]; seen uuid[]:=ARRAY[]::uuid[]; node uuid; relation text;
BEGIN
 IF TG_OP='UPDATE' THEN
  old_kind:=OLD.payload->>'recordType';
  IF old_kind IN ('source','archival-unit') AND p->>'recordType' IS DISTINCT FROM old_kind THEN RAISE EXCEPTION 'Source record type is immutable'; END IF;
 END IF;
 IF NOT COALESCE(p->>'recordType' IN ('source','archival-unit'),false) THEN RETURN NEW; END IF;
 IF p->>'id' IS DISTINCT FROM NEW.id::text OR p->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR octet_length(p::text)>262144 OR NOT garden_control.historical_text_valid(p->'title',300,true) THEN RAISE EXCEPTION 'Source record identity'; END IF;
 IF NOT garden_control.catalog_assertions_valid(p->'assertions') THEN RAISE EXCEPTION 'Catalog assertion shape'; END IF;
 IF old_kind IN ('source','archival-unit') AND NOT (p->'assertions') @> (OLD.payload->'assertions') THEN RAISE EXCEPTION 'Catalog assertions must be preserved'; END IF;
 IF p->>'recordType'='archival-unit' THEN
  IF NOT p ?& ARRAY['recordType','schemaVersion','id','title','level','parentId','assertions','notes'] OR p-ARRAY['recordType','schemaVersion','id','title','level','parentId','assertions','notes']<>'{}'::jsonb
   OR NOT COALESCE(p->>'level' IN ('repository','collection','series','item'),false) OR NOT garden_control.historical_text_valid(p->'notes',4000,true)
   OR (p->'parentId'<>'null'::jsonb AND NOT COALESCE(p->>'parentId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)) THEN RAISE EXCEPTION 'Archival unit shape'; END IF;
  IF old_kind='archival-unit' AND OLD.payload->>'level' IS DISTINCT FROM p->>'level' THEN RAISE EXCEPTION 'Archival level is immutable'; END IF;
  IF p->>'level'='repository' AND p->'parentId'<>'null'::jsonb THEN RAISE EXCEPTION 'Repository must be a root'; END IF;
 ELSE
  IF NOT p ?& ARRAY['recordType','schemaVersion','id','title','form','archivalItemId','derivedFrom','assertions','representation'] OR p-ARRAY['recordType','schemaVersion','id','title','form','archivalItemId','derivedFrom','assertions','representation']<>'{}'::jsonb
   OR NOT COALESCE(p->>'form' IN ('witness','edition','digital-representation'),false)
   OR jsonb_typeof(p->'derivedFrom') IS DISTINCT FROM 'array'
   OR (p->'archivalItemId'<>'null'::jsonb AND NOT COALESCE(p->>'archivalItemId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)) THEN RAISE EXCEPTION 'Source shape'; END IF;
  IF jsonb_array_length(p->'derivedFrom')>32 OR (p->>'form'='witness' AND jsonb_array_length(p->'derivedFrom')<>0) THEN RAISE EXCEPTION 'Derivation bound'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'derivedFrom') e WHERE NOT COALESCE(e#>>'{}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false))
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'derivedFrom') e GROUP BY e HAVING count(*)>1) THEN RAISE EXCEPTION 'Derivation identity'; END IF;
  IF (p->'derivedFrom') ? (p->>'archivalItemId') THEN RAISE EXCEPTION 'Archive and derivation identities must be distinct'; END IF;
  IF old_kind='source' AND OLD.payload->>'form' IS DISTINCT FROM p->>'form' THEN RAISE EXCEPTION 'Source form is immutable'; END IF;
  IF p->>'form'='digital-representation' THEN
   r:=p->'representation';
   IF jsonb_array_length(p->'derivedFrom')<>1 OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR NOT r ?& ARRAY['sha256','mediaType','byteLength','originalFilename'] OR r-ARRAY['sha256','mediaType','byteLength','originalFilename']<>'{}'::jsonb
    OR jsonb_typeof(r->'sha256') IS DISTINCT FROM 'string' OR NOT garden_control.historical_text_valid(r->'mediaType',120,false)
    OR NOT COALESCE(r->>'sha256' ~ '^[0-9a-f]{64}$',false) OR NOT COALESCE(r->>'mediaType' ~ '^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+$',false)
    OR NOT garden_control.historical_text_valid(r->'originalFilename',300,true) OR jsonb_typeof(r->'byteLength') IS DISTINCT FROM 'number' OR (r->>'byteLength') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Digital representation shape'; END IF;
   IF (r->>'byteLength')::numeric>9007199254740991 THEN RAISE EXCEPTION 'Digital size bound'; END IF;
  ELSIF p->'representation' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Only digital representations have file metadata'; END IF;
 END IF;
 -- Shared transaction lock prevents concurrent writes from independently adding a cycle.
 PERFORM pg_advisory_xact_lock(hashtextextended('garden/source-graph/'||NEW.workspace_id::text,0));
 q:=garden_control.source_edges(p);
 FOREACH node IN ARRAY q LOOP
  SELECT payload INTO target FROM garden_private.record_envelopes WHERE workspace_id=NEW.workspace_id AND id=node;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source reference unavailable'; END IF;
  IF p->>'recordType'='archival-unit' THEN
   IF target->>'recordType' IS DISTINCT FROM 'archival-unit' OR NOT COALESCE(CASE p->>'level'
    WHEN 'collection' THEN target->>'level' IN ('repository','collection') WHEN 'series' THEN target->>'level' IN ('collection','series') WHEN 'item' THEN target->>'level' IN ('repository','collection','series') ELSE false END,false) THEN RAISE EXCEPTION 'Archival parent type'; END IF;
  ELSIF node::text=p->>'archivalItemId' THEN
   IF target->>'recordType' IS DISTINCT FROM 'archival-unit' OR target->>'level' IS DISTINCT FROM 'item' THEN RAISE EXCEPTION 'Archive locator must reference an item'; END IF;
  ELSIF target->>'recordType' IS DISTINCT FROM 'source' THEN RAISE EXCEPTION 'Source derivation type'; END IF;
 END LOOP;
 WHILE cardinality(q)>0 LOOP
  node:=q[1];q:=q[2:];
  IF node=NEW.id THEN RAISE EXCEPTION 'Source graph cycle'; END IF;
  IF node=ANY(seen) THEN CONTINUE; END IF;
  IF cardinality(seen)>=512 THEN RAISE EXCEPTION 'Source graph inspection bound'; END IF;
  seen:=array_append(seen,node);
  SELECT payload INTO target FROM garden_private.record_envelopes WHERE workspace_id=NEW.workspace_id AND id=node;
  IF NOT FOUND OR NOT COALESCE(target->>'recordType' IN ('source','archival-unit'),false) THEN RAISE EXCEPTION 'Source graph unavailable'; END IF;
  q:=q||garden_control.source_edges(target);
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER source_shape BEFORE INSERT OR UPDATE ON garden_private.record_envelopes FOR EACH ROW EXECUTE FUNCTION garden_control.validate_source_record();
CREATE VIEW garden_private.archival_units WITH(security_invoker=true,security_barrier=true) AS
 SELECT id,workspace_id,version,payload->>'level' AS level,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='archival-unit';
CREATE VIEW garden_private.sources WITH(security_invoker=true,security_barrier=true) AS
 SELECT id,workspace_id,version,payload->>'form' AS form,payload FROM garden_private.record_envelopes WHERE payload->>'recordType'='source';
CREATE VIEW garden_private.witnesses WITH(security_invoker=true,security_barrier=true) AS
 SELECT * FROM garden_private.sources WHERE form='witness';
CREATE VIEW garden_private.source_derivations WITH(security_invoker=true,security_barrier=true) AS
 SELECT r.id AS source_id,r.workspace_id,r.version,d::uuid AS parent_id FROM garden_private.record_envelopes r CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN r.payload->>'recordType'='source' THEN r.payload->'derivedFrom' ELSE '[]'::jsonb END) d;
GRANT SELECT ON garden_private.archival_units,garden_private.sources,garden_private.witnesses,garden_private.source_derivations TO garden_research;
REVOKE ALL ON FUNCTION garden_control.catalog_assertions_valid(jsonb),garden_control.source_edges(jsonb),garden_control.validate_source_record() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.catalog_assertions_valid(jsonb),garden_control.source_edges(jsonb) TO garden_research;
RESET ROLE;
