-- GDN-039: independent review dimensions bound to one exact working-record revision.
-- No publication row, legal permission, historical truth or conformance certificate is created.
SET LOCAL ROLE garden_migrator;
CREATE TABLE garden_control.review_axis_rules (
 version integer NOT NULL CHECK(version=1), axis text NOT NULL, rule jsonb NOT NULL,
 PRIMARY KEY(version,axis), CHECK(rule->>'id'=axis AND jsonb_typeof(rule)='object')
);
INSERT INTO garden_control.review_axis_rules(version,axis,rule) VALUES
(1,'acquisition','{"id":"acquisition","initial":"unassessed","states":["unassessed","in-progress","recorded","unavailable","disputed"],"transitions":{"unassessed":["in-progress"],"in-progress":["recorded","unavailable","disputed"],"disputed":["in-progress"],"recorded":["disputed"],"unavailable":["in-progress","disputed"]},"roles":{"in-progress":["contributor","researcher","editor"],"recorded":["contributor","researcher","editor"],"unavailable":["contributor","researcher","editor"]},"passing":["recorded"],"independentStates":[],"assignmentKind":null}'::jsonb),
(1,'transcription','{"id":"transcription","initial":"unassessed","states":["unassessed","in-progress","checked","not-applicable","disputed"],"transitions":{"unassessed":["in-progress"],"in-progress":["checked","not-applicable","disputed"],"disputed":["in-progress"],"checked":["disputed"],"not-applicable":["disputed"]},"roles":{"in-progress":["transcriber","translator","researcher","editor"],"checked":["reviewer"],"not-applicable":["reviewer"]},"passing":["checked","not-applicable"],"independentStates":["checked","not-applicable"],"assignmentKind":"research"}'::jsonb),
(1,'evidentiary-review','{"id":"evidentiary-review","initial":"unassessed","states":["unassessed","in-review","reviewed","contested","requires-correction","disputed"],"transitions":{"unassessed":["in-review"],"in-review":["reviewed","contested","requires-correction","disputed"],"disputed":["in-review"],"reviewed":["disputed"],"contested":["in-review","disputed"],"requires-correction":["in-review","disputed"]},"roles":{"in-review":["reviewer"],"reviewed":["reviewer"],"contested":["reviewer"],"requires-correction":["reviewer"]},"passing":["reviewed"],"independentStates":["reviewed","contested","requires-correction"],"assignmentKind":"research"}'::jsonb),
(1,'rights','{"id":"rights","initial":"unassessed","states":["unassessed","in-review","cleared","restricted","disputed"],"transitions":{"unassessed":["in-review"],"in-review":["cleared","restricted","disputed"],"disputed":["in-review"],"cleared":["disputed"],"restricted":["in-review","disputed"]},"roles":{"in-review":["rights_reviewer"],"cleared":["rights_reviewer"],"restricted":["rights_reviewer"]},"passing":["cleared"],"independentStates":["cleared","restricted"],"assignmentKind":"rights"}'::jsonb),
(1,'consent','{"id":"consent","initial":"unassessed","states":["unassessed","in-review","documented","not-required","withdrawn","disputed"],"transitions":{"unassessed":["in-review"],"in-review":["documented","not-required","withdrawn","disputed"],"disputed":["in-review"],"documented":["disputed"],"not-required":["disputed"],"withdrawn":["in-review","disputed"]},"roles":{"in-review":["editor"],"documented":["editor"],"not-required":["editor"],"withdrawn":["editor"]},"passing":["documented","not-required"],"independentStates":[],"assignmentKind":null}'::jsonb),
(1,'accessibility','{"id":"accessibility","initial":"unassessed","states":["unassessed","in-progress","checked","needs-work","disputed"],"transitions":{"unassessed":["in-progress"],"in-progress":["checked","needs-work","disputed"],"disputed":["in-progress"],"checked":["disputed"],"needs-work":["in-progress","disputed"]},"roles":{"in-progress":["contributor","researcher","editor"],"checked":["reviewer"],"needs-work":["reviewer"]},"passing":["checked"],"independentStates":["checked","needs-work"],"assignmentKind":"research"}'::jsonb),
(1,'publication','{"id":"publication","initial":"private","states":["private","in-review","ready-for-release-review","withdrawn","disputed"],"transitions":{"private":["in-review"],"in-review":["ready-for-release-review","withdrawn","disputed"],"disputed":["in-review"],"ready-for-release-review":["disputed","withdrawn"],"withdrawn":["in-review","disputed"]},"roles":{"in-review":["editor"],"ready-for-release-review":["editor"],"withdrawn":["editor"]},"passing":["ready-for-release-review"],"independentStates":["ready-for-release-review"],"assignmentKind":null}'::jsonb);

CREATE TABLE garden_control.review_scopes (
 workspace_id uuid NOT NULL, id uuid NOT NULL, record_id uuid NOT NULL, record_version bigint NOT NULL,
 record_sha256 text NOT NULL CHECK(record_sha256 ~ '^[0-9a-f]{64}$'), authors text[] NOT NULL CHECK(cardinality(authors) BETWEEN 1 AND 256),
 authorship_complete boolean NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,record_id,record_version),
 FOREIGN KEY(workspace_id,id) REFERENCES garden_control.review_targets(workspace_id,target_id),
 FOREIGN KEY(workspace_id,record_id,record_version) REFERENCES garden_private.record_revisions(workspace_id,record_id,version)
);
CREATE TABLE garden_control.review_assignment_receipts (
 assignment_id uuid PRIMARY KEY REFERENCES garden_control.review_assignments(id), workspace_id uuid NOT NULL, scope_id uuid NOT NULL,
 assigner_version bigint NOT NULL, reviewer_version bigint NOT NULL, issuer_grant_version bigint NOT NULL, reviewer_grant_version bigint NOT NULL,
 FOREIGN KEY(workspace_id,scope_id) REFERENCES garden_control.review_scopes(workspace_id,id)
);
CREATE TABLE garden_control.status_snapshots (
 workspace_id uuid NOT NULL, scope_id uuid NOT NULL, version bigint NOT NULL DEFAULT 0 CHECK(version>=0), states jsonb NOT NULL,
 PRIMARY KEY(workspace_id,scope_id), FOREIGN KEY(workspace_id,scope_id) REFERENCES garden_control.review_scopes(workspace_id,id),
 CHECK(jsonb_typeof(states)='object' AND states ?& ARRAY['acquisition','transcription','evidentiary-review','rights','consent','accessibility','publication'] AND
 states - ARRAY['acquisition','transcription','evidentiary-review','rights','consent','accessibility','publication']='{}'::jsonb)
);
CREATE TABLE garden_control.status_events (
 workspace_id uuid NOT NULL, scope_id uuid NOT NULL, sequence bigint NOT NULL CHECK(sequence>0), id uuid NOT NULL DEFAULT gen_random_uuid(),
 rule_version integer NOT NULL DEFAULT 1, axis text NOT NULL, kind text NOT NULL CHECK(kind IN ('transition','reopen','import-observation')),
 from_state text NOT NULL, to_state text NOT NULL, actor_subject_id text NOT NULL, actor_role text NOT NULL,
 assignment_id uuid REFERENCES garden_control.review_assignments(id), evidence jsonb NOT NULL,
 rationale text, imported_namespace text, imported_verbatim text, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,scope_id,sequence), UNIQUE(id),
 FOREIGN KEY(workspace_id,scope_id) REFERENCES garden_control.review_scopes(workspace_id,id),
 FOREIGN KEY(rule_version,axis) REFERENCES garden_control.review_axis_rules(version,axis),
 FOREIGN KEY(workspace_id,actor_subject_id) REFERENCES garden_control.access_members(workspace_id,subject_id),
 CHECK(jsonb_typeof(evidence)='array' AND jsonb_array_length(evidence)<=32 AND octet_length(evidence::text)<=8192),
 CHECK((kind='import-observation' AND rationale IS NULL AND imported_namespace IS NOT NULL AND imported_verbatim IS NOT NULL AND length(btrim(imported_namespace)) BETWEEN 1 AND 300 AND length(btrim(imported_verbatim)) BETWEEN 1 AND 2000 AND from_state=to_state) OR
 (kind IN ('transition','reopen') AND rationale IS NOT NULL AND length(btrim(rationale)) BETWEEN 1 AND 2000 AND imported_namespace IS NULL AND imported_verbatim IS NULL))
);
CREATE VIEW garden_control.review_decisions WITH (security_invoker=true,security_barrier=true) AS
 SELECT workspace_id,scope_id,sequence,id,axis,from_state,to_state,actor_subject_id,actor_role,assignment_id,evidence,rationale,recorded_at
 FROM garden_control.status_events WHERE kind='transition';
REVOKE ALL ON garden_control.review_axis_rules,garden_control.review_scopes,garden_control.review_assignment_receipts,garden_control.status_snapshots,garden_control.status_events,garden_control.review_decisions FROM PUBLIC,garden_research,garden_public,garden_publisher,garden_worker,garden_context_issuer,garden_membership_admin,garden_consent_admin,garden_audit_reader,garden_audit_writer;
ALTER TABLE garden_control.review_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_control.review_scopes FORCE ROW LEVEL SECURITY;
CREATE POLICY review_scope_internal ON garden_control.review_scopes TO garden_migrator USING(true) WITH CHECK(true);
ALTER TABLE garden_control.status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_control.status_events FORCE ROW LEVEL SECURITY;
CREATE POLICY status_event_read ON garden_control.status_events FOR SELECT TO garden_migrator USING(true);
CREATE POLICY status_event_append ON garden_control.status_events FOR INSERT TO garden_migrator WITH CHECK(true);
ALTER TABLE garden_control.status_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_control.status_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY status_snapshot_internal ON garden_control.status_snapshots TO garden_migrator USING(true) WITH CHECK(true);
CREATE TRIGGER review_scope_immutable BEFORE UPDATE OR DELETE ON garden_control.review_scopes FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER review_rules_immutable BEFORE UPDATE OR DELETE ON garden_control.review_axis_rules FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER review_receipt_immutable BEFORE UPDATE OR DELETE ON garden_control.review_assignment_receipts FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
CREATE TRIGGER status_event_immutable BEFORE UPDATE OR DELETE ON garden_control.status_events FOR EACH ROW EXECUTE FUNCTION garden_control.audit_immutable();
-- Internal review functions see only records admitted by the already bound
-- research context AND live purpose consent. WITH CHECK(false) permits row
-- locking, never a definer's UPDATE of a source payload.
CREATE POLICY record_review_read ON garden_private.record_envelopes FOR SELECT TO garden_migrator USING(
 garden_control.may_access_record(workspace_id,id,classification,state,'read') AND garden_control.research_consent_allows(workspace_id,id));
CREATE POLICY record_review_lock ON garden_private.record_envelopes FOR UPDATE TO garden_migrator USING(
 garden_control.may_access_record(workspace_id,id,classification,state,'read') AND garden_control.research_consent_allows(workspace_id,id)) WITH CHECK(false);
CREATE POLICY revision_review_read ON garden_private.record_revisions FOR SELECT TO garden_migrator USING(
 EXISTS(SELECT 1 FROM garden_private.record_envelopes r WHERE r.workspace_id=record_revisions.workspace_id AND r.id=record_revisions.record_id));

CREATE FUNCTION garden_control.review_actor(p_workspace uuid,p_record uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE t garden_control.policy_tickets%ROWTYPE;
BEGIN
 SELECT q.* INTO t FROM garden_control.policy_contexts c JOIN garden_control.policy_tickets q ON q.token_hash=c.token_hash
 WHERE c.backend_pid=pg_backend_pid() AND c.transaction_id=pg_current_xact_id_if_assigned() AND q.workspace_id=p_workspace
 AND q.action IN ('read','write') AND q.purpose='research' AND q.used_at IS NOT NULL AND q.expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 PERFORM 1 FROM garden_control.access_workspaces WHERE id=p_workspace AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 PERFORM 1 FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id=t.subject_id AND state='active' AND version=t.member_version FOR SHARE;
 IF NOT FOUND OR NOT garden_control.membership_active(p_workspace,t.subject_id) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 PERFORM 1 FROM garden_control.record_grants WHERE workspace_id=p_workspace AND record_id=p_record AND subject_id=t.subject_id AND purpose='research' AND can_read AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 PERFORM 1 FROM garden_private.record_envelopes WHERE workspace_id=p_workspace AND id=p_record FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 RETURN t.subject_id;
END $$;
CREATE FUNCTION garden_control.review_role(p_workspace uuid,p_actor text,p_roles text[]) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE r garden_control.access_roles%ROWTYPE;
BEGIN
 SELECT * INTO r FROM garden_control.access_roles WHERE workspace_id=p_workspace AND subject_id=p_actor AND role=ANY(p_roles)
 AND revoked_at IS NULL AND expires_at>clock_timestamp() ORDER BY role,id LIMIT 1 FOR SHARE;
 IF NOT FOUND OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF; RETURN r.role;
END $$;
CREATE FUNCTION garden_control.review_evidence_valid(p_workspace uuid,p_evidence jsonb) RETURNS boolean
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
  IF NOT FOUND OR NOT COALESCE(r.payload->>'recordType' IN ('entity','relationship','source','archival-unit','locator','claim','evidence-link','claim-placement'),false) THEN RETURN false; END IF;
 END LOOP; RETURN true;
END $$;
CREATE FUNCTION garden_control.register_review_scope(p_workspace uuid,p_id uuid,p_record uuid,p_version bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE actor text; r garden_private.record_envelopes%ROWTYPE; v garden_private.record_revisions%ROWTYPE; old uuid; authors text[]; complete boolean; fingerprint text; initial jsonb;
BEGIN
 IF p_id IS NULL OR p_record IS NULL OR p_version IS NULL OR p_version<1 THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(144729,hashtext(p_workspace::text));
 actor:=garden_control.review_actor(p_workspace,p_record);PERFORM garden_control.review_role(p_workspace,actor,ARRAY['editor']);
 SELECT * INTO STRICT r FROM garden_private.record_envelopes WHERE workspace_id=p_workspace AND id=p_record;
 SELECT * INTO v FROM garden_private.record_revisions WHERE workspace_id=p_workspace AND record_id=p_record AND version=p_version;
 IF NOT FOUND OR NOT COALESCE(v.payload->>'recordType' IN ('entity','relationship','source','archival-unit','locator','claim','evidence-link','claim-placement'),false) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
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
CREATE FUNCTION garden_control.assign_scoped_reviewer(p_workspace uuid,p_scope uuid,p_reviewer text,p_kind text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE s garden_control.review_scopes%ROWTYPE; actor text; rid uuid; a garden_control.review_assignments%ROWTYPE;
BEGIN
 SELECT * INTO s FROM garden_control.review_scopes WHERE workspace_id=p_workspace AND id=p_scope;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 actor:=garden_control.review_actor(p_workspace,s.record_id);PERFORM garden_control.review_role(p_workspace,actor,ARRAY['editor']);
 IF p_reviewer IS NULL OR length(btrim(p_reviewer)) NOT BETWEEN 1 AND 128 OR p_reviewer=ANY(s.authors) OR NOT s.authorship_complete OR
  (SELECT version FROM garden_private.record_envelopes WHERE workspace_id=p_workspace AND id=s.record_id)<>s.record_version THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 PERFORM 1 FROM garden_control.record_grants WHERE workspace_id=p_workspace AND record_id=s.record_id AND subject_id=p_reviewer AND purpose='research' AND can_read AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 rid:=garden_control.assign_reviewer(p_workspace,actor,p_reviewer,p_scope,s.record_sha256,p_kind);
 SELECT * INTO STRICT a FROM garden_control.review_assignments WHERE id=rid;
 INSERT INTO garden_control.review_assignment_receipts(assignment_id,workspace_id,scope_id,assigner_version,reviewer_version,issuer_grant_version,reviewer_grant_version)
 SELECT a.id,p_workspace,p_scope,m.version,n.version,i.version,r.version FROM garden_control.access_members m,garden_control.access_members n,garden_control.access_roles i,garden_control.access_roles r
 WHERE m.workspace_id=p_workspace AND m.subject_id=actor AND n.workspace_id=p_workspace AND n.subject_id=p_reviewer AND i.id=a.issuer_grant_id AND r.id=a.reviewer_grant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 RETURN rid;
END $$;
CREATE FUNCTION garden_control.scoped_assignment_current(p_workspace uuid,p_scope uuid,p_assignment uuid,p_actor text,p_kind text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE a garden_control.review_assignments%ROWTYPE; s garden_control.review_scopes%ROWTYPE; receipt garden_control.review_assignment_receipts%ROWTYPE; i garden_control.access_roles%ROWTYPE; r garden_control.access_roles%ROWTYPE;
BEGIN
 SELECT * INTO receipt FROM garden_control.review_assignment_receipts WHERE assignment_id=p_assignment AND workspace_id=p_workspace AND scope_id=p_scope;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO a FROM garden_control.review_assignments WHERE id=p_assignment AND workspace_id=p_workspace AND target_id=p_scope FOR SHARE;
 SELECT * INTO s FROM garden_control.review_scopes WHERE workspace_id=p_workspace AND id=p_scope;
 IF a.id IS NULL OR a.state<>'assigned' OR a.kind IS DISTINCT FROM p_kind OR a.reviewer_subject_id IS DISTINCT FROM p_actor OR a.revision_sha256 IS DISTINCT FROM s.record_sha256 OR p_actor=ANY(s.authors) THEN RETURN false; END IF;
 PERFORM 1 FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id IN (a.assigned_by,a.reviewer_subject_id) ORDER BY subject_id FOR SHARE;
 IF NOT garden_control.membership_active(p_workspace,a.assigned_by) OR NOT garden_control.membership_active(p_workspace,a.reviewer_subject_id) OR
 NOT EXISTS(SELECT 1 FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id=a.assigned_by AND version=receipt.assigner_version) OR
 NOT EXISTS(SELECT 1 FROM garden_control.access_members WHERE workspace_id=p_workspace AND subject_id=a.reviewer_subject_id AND version=receipt.reviewer_version) THEN RETURN false; END IF;
 SELECT * INTO i FROM garden_control.access_roles WHERE id=a.issuer_grant_id FOR SHARE;
 SELECT * INTO r FROM garden_control.access_roles WHERE id=a.reviewer_grant_id FOR SHARE;
 RETURN COALESCE(i.version=receipt.issuer_grant_version AND r.version=receipt.reviewer_grant_version AND i.role IN ('editor','administrator') AND r.role=CASE p_kind WHEN 'research' THEN 'reviewer' WHEN 'rights' THEN 'rights_reviewer' WHEN 'community' THEN 'community_adviser' END AND i.revoked_at IS NULL AND r.revoked_at IS NULL AND i.expires_at>clock_timestamp() AND r.expires_at>clock_timestamp(),false);
END $$;
CREATE FUNCTION garden_control.scoped_review_snapshot(p_workspace uuid,p_scope uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE s garden_control.review_scopes%ROWTYPE; board garden_control.status_snapshots%ROWTYPE; r garden_private.record_envelopes%ROWTYPE; ev record;
BEGIN
 SELECT * INTO s FROM garden_control.review_scopes WHERE workspace_id=p_workspace AND id=p_scope;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 PERFORM garden_control.review_actor(p_workspace,s.record_id);
 SELECT * INTO STRICT r FROM garden_private.record_envelopes WHERE workspace_id=p_workspace AND id=s.record_id;
 SELECT * INTO STRICT board FROM garden_control.status_snapshots WHERE workspace_id=p_workspace AND scope_id=p_scope;
 FOR ev IN SELECT DISTINCT ON(axis) evidence FROM garden_control.status_events WHERE workspace_id=p_workspace AND scope_id=p_scope AND kind<>'import-observation' ORDER BY axis,sequence DESC LOOP
  IF NOT garden_control.review_evidence_valid(p_workspace,ev.evidence) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 END LOOP;
 RETURN jsonb_build_object('schemaVersion',1,'scope',jsonb_build_object('id',s.id,'recordId',s.record_id,'revision',s.record_version::text,'digest',s.record_sha256,'digestProfile','postgres-jsonb-text-sha256','coverage','exact-record-revision','authorshipComplete',s.authorship_complete),'version',board.version::text,'states',board.states,'currentRevision',r.version::text,'publicUseAllowed',garden_control.consent_allows(p_workspace,s.record_id,'public-display',clock_timestamp()),'publicationReleased',false);
END $$;
CREATE FUNCTION garden_control.record_scoped_status(p_workspace uuid,p_scope uuid,p_kind text,p_event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE s garden_control.review_scopes%ROWTYPE; board garden_control.status_snapshots%ROWTYPE; actor text; actor_role text; rule jsonb; v_axis text; target text; source text; roles text[]; assigned uuid; snapshot jsonb; basis text; evidence jsonb; expected bigint; v bigint; e_id uuid; audit_action text;
BEGIN
 IF p_workspace IS NULL OR p_scope IS NULL OR p_kind IS NULL OR p_kind NOT IN ('transition','reopen','import-observation') OR p_event IS NULL OR jsonb_typeof(p_event)<>'object' OR octet_length(p_event::text)>16384 THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 IF p_kind='transition' AND (NOT p_event ?& ARRAY['axis','fromState','toState','expectedVersion','assignmentId','evidence','rationale'] OR p_event-ARRAY['axis','fromState','toState','expectedVersion','assignmentId','evidence','rationale']<>'{}'::jsonb) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 IF p_kind='reopen' AND (NOT p_event ?& ARRAY['axis','fromState','expectedVersion','evidence','rationale'] OR p_event-ARRAY['axis','fromState','expectedVersion','evidence','rationale']<>'{}'::jsonb) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 IF p_kind='import-observation' AND (NOT p_event ?& ARRAY['axis','expectedVersion','namespace','verbatim','evidence'] OR p_event-ARRAY['axis','expectedVersion','namespace','verbatim','evidence']<>'{}'::jsonb) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 IF jsonb_typeof(p_event->'axis')<>'string' OR jsonb_typeof(p_event->'expectedVersion')<>'string' OR NOT COALESCE(p_event->>'expectedVersion' ~ '^(0|[1-9][0-9]{0,18})$',false) OR (p_event->>'expectedVersion')::numeric>=9223372036854775807 THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 expected:=(p_event->>'expectedVersion')::bigint;v_axis:=p_event->>'axis';
 SELECT r.rule INTO rule FROM garden_control.review_axis_rules r WHERE r.version=1 AND r.axis=v_axis;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 SELECT * INTO s FROM garden_control.review_scopes WHERE workspace_id=p_workspace AND id=p_scope;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 -- Same consent lock as policy/grant/withdrawal; no independently stale clearance.
 PERFORM pg_advisory_xact_lock(144729,hashtext(p_workspace::text));
 actor:=garden_control.review_actor(p_workspace,s.record_id);
 SELECT * INTO STRICT board FROM garden_control.status_snapshots WHERE workspace_id=p_workspace AND scope_id=p_scope FOR UPDATE;
 IF board.version<>expected THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 source:=board.states->>v_axis;evidence:=p_event->'evidence';
 IF NOT garden_control.review_evidence_valid(p_workspace,evidence) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 IF p_kind='import-observation' THEN
  actor_role:=garden_control.review_role(p_workspace,actor,ARRAY['editor']);target:=source;
  IF jsonb_typeof(p_event->'namespace')<>'string' OR p_event->>'namespace' ~ '[[:cntrl:]]' OR jsonb_typeof(p_event->'verbatim')<>'string' OR NOT COALESCE(length(btrim(p_event->>'namespace')) BETWEEN 1 AND 300,false) OR NOT COALESCE(length(btrim(p_event->>'verbatim')) BETWEEN 1 AND 2000,false) OR jsonb_array_length(evidence)=0 THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
  audit_action:='review.import';
 ELSE
  IF jsonb_typeof(p_event->'fromState')<>'string' OR p_event->>'fromState' IS DISTINCT FROM source OR jsonb_typeof(p_event->'rationale')<>'string' OR p_event->>'rationale' ~ '[[:cntrl:]]' OR NOT COALESCE(length(btrim(p_event->>'rationale')) BETWEEN 1 AND 2000,false) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
  IF p_kind='reopen' THEN
   target:='disputed';actor_role:='scoped-reader';audit_action:='review.reopen';
  ELSE
   IF jsonb_typeof(p_event->'toState')<>'string' OR p_event->>'toState'='disputed' THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
   target:=p_event->>'toState';SELECT array_agg(x) INTO roles FROM jsonb_array_elements_text(rule->'roles'->target) x;
   actor_role:=garden_control.review_role(p_workspace,actor,roles);audit_action:='review.decision';
   IF (SELECT version FROM garden_private.record_envelopes WHERE workspace_id=p_workspace AND id=s.record_id)<>s.record_version THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
   IF p_event->'assignmentId'<>'null'::jsonb THEN
    IF jsonb_typeof(p_event->'assignmentId')<>'string' OR NOT COALESCE(p_event->>'assignmentId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
    assigned:=(p_event->>'assignmentId')::uuid;
   END IF;
   IF NOT ((rule->'independentStates' ? target) AND rule->>'assignmentKind' IS NOT NULL) AND assigned IS NOT NULL THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
   IF rule->'independentStates' ? target THEN
    IF NOT s.authorship_complete OR actor=ANY(s.authors) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
    IF rule->>'assignmentKind' IS NOT NULL AND NOT garden_control.scoped_assignment_current(p_workspace,p_scope,assigned,actor,rule->>'assignmentKind') THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
   END IF;
   IF rule->'passing' ? target AND jsonb_array_length(evidence)=0 THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
   IF v_axis='consent' THEN
    SELECT r.policy->>'basis' INTO basis FROM garden_control.use_policy_heads h JOIN garden_control.use_policy_revisions r USING(workspace_id,record_id,version) WHERE h.workspace_id=p_workspace AND h.record_id=s.record_id;
    IF target IN ('documented','not-required') AND (NOT garden_control.consent_allows(p_workspace,s.record_id,'public-display',clock_timestamp()) OR (target='not-required' AND basis IS DISTINCT FROM 'no-consent-required') OR (target='documented' AND basis NOT IN ('consent-required','inherits-only'))) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
    IF target='withdrawn' AND garden_control.consent_allows(p_workspace,s.record_id,'public-display',clock_timestamp()) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
   END IF;
   IF v_axis='publication' AND target='ready-for-release-review' THEN
    IF EXISTS(SELECT 1 FROM garden_control.review_axis_rules q WHERE q.version=1 AND q.axis<>'publication' AND NOT (q.rule->'passing' ? (board.states->>q.axis))) OR NOT garden_control.consent_allows(p_workspace,s.record_id,'public-display',clock_timestamp()) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
   END IF;
  END IF;
  IF NOT COALESCE((rule->'transitions'->source) ? target,false) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 END IF;
 -- Check the current decision evidence again before changing the snapshot.
 PERFORM garden_control.scoped_review_snapshot(p_workspace,p_scope);
 IF p_kind='transition' THEN
  PERFORM garden_control.review_role(p_workspace,actor,roles);
  IF (rule->'independentStates' ? target) AND rule->>'assignmentKind' IS NOT NULL AND NOT garden_control.scoped_assignment_current(p_workspace,p_scope,assigned,actor,rule->>'assignmentKind') THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 END IF;
 v:=board.version+1;
 INSERT INTO garden_control.status_events(workspace_id,scope_id,sequence,axis,kind,from_state,to_state,actor_subject_id,actor_role,assignment_id,evidence,rationale,imported_namespace,imported_verbatim)
 VALUES(p_workspace,p_scope,v,v_axis,p_kind,source,target,actor,actor_role,assigned,evidence,p_event->>'rationale',p_event->>'namespace',p_event->>'verbatim') RETURNING id INTO e_id;
 UPDATE garden_control.status_snapshots SET version=v,states=jsonb_set(states,ARRAY[v_axis],to_jsonb(target)) WHERE workspace_id=p_workspace AND scope_id=p_scope;
 PERFORM garden_control.append_audit_event(p_workspace,'subject',actor,'review',e_id::text,v,audit_action);
 RETURN garden_control.scoped_review_snapshot(p_workspace,p_scope);
END $$;
CREATE FUNCTION garden_control.scoped_review_history(p_workspace uuid,p_scope uuid,p_after bigint,p_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE s garden_control.review_scopes%ROWTYPE; e garden_control.status_events%ROWTYPE; result jsonb:='[]'::jsonb; n integer:=0; last_seq bigint; more boolean:=false;
BEGIN
 IF p_after IS NULL OR p_after<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
 SELECT * INTO s FROM garden_control.review_scopes WHERE workspace_id=p_workspace AND id=p_scope;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;PERFORM garden_control.review_actor(p_workspace,s.record_id);
 FOR e IN SELECT * FROM garden_control.status_events WHERE workspace_id=p_workspace AND scope_id=p_scope AND sequence>p_after ORDER BY sequence LIMIT p_limit+1 LOOP
  n:=n+1;IF n>p_limit THEN more:=true;EXIT; END IF;
  IF NOT garden_control.review_evidence_valid(p_workspace,e.evidence) THEN RAISE EXCEPTION 'Scoped review unavailable'; END IF;
  result:=result||jsonb_build_array(jsonb_build_object('id',e.id,'scopeId',e.scope_id,'sequence',e.sequence::text,'axis',e.axis,'kind',e.kind,'fromState',e.from_state,'toState',e.to_state,'actor',jsonb_build_object('subjectId',e.actor_subject_id,'role',e.actor_role),'assignmentId',e.assignment_id,'evidence',e.evidence,'rationale',e.rationale,'imported',CASE WHEN e.kind='import-observation' THEN jsonb_build_object('namespace',e.imported_namespace,'verbatim',e.imported_verbatim) ELSE NULL END,'recordedAt',to_char(e.recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
  last_seq:=e.sequence;
 END LOOP;
 RETURN jsonb_build_object('events',result,'nextAfter',CASE WHEN more THEN last_seq::text ELSE NULL END,'wholeWorkVerified',false);
END $$;

CREATE OR REPLACE FUNCTION garden_control.append_audit_event(p_workspace uuid,p_actor_kind text,p_actor text,p_subject_kind text,p_subject text,p_version bigint,p_action text,p_request uuid DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,garden_control,pg_temp AS $$
DECLARE h garden_control.audit_heads%ROWTYPE; actor_ref uuid; subject_ref uuid; request_ref uuid; expected_kind text; outcome text:='succeeded'; reason text; e jsonb; serialized text; digest text;
BEGIN
 IF p_workspace IS NULL OR (p_version IS NOT NULL AND p_version<=0) THEN RAISE EXCEPTION 'Audit event unavailable'; END IF;
 CASE p_action
  WHEN 'record.create' THEN expected_kind:='record';reason:='record-created';
  WHEN 'record.revise' THEN expected_kind:='record';reason:='record-revised';
  WHEN 'consent.policy' THEN expected_kind:='record';reason:='policy-revised';
  WHEN 'consent.grant' THEN expected_kind:='grant';reason:='permission-recorded';
  WHEN 'consent.withdraw' THEN expected_kind:='grant';reason:='permission-withdrawn';
  WHEN 'consent.use' THEN expected_kind:='record';reason:='permission-checked';outcome:='allowed';
  WHEN 'review.scope' THEN expected_kind:='review';reason:='review-scope-created';
  WHEN 'review.decision' THEN expected_kind:='review';reason:='scoped-decision-recorded';
  WHEN 'review.reopen' THEN expected_kind:='review';reason:='scoped-review-reopened';
  WHEN 'review.import' THEN expected_kind:='review';reason:='imported-status-preserved';
  WHEN 'review.assign' THEN expected_kind:='review';reason:='reviewer-assigned';
  WHEN 'membership.change' THEN expected_kind:='identity';reason:='membership-changed';
  WHEN 'role.change' THEN expected_kind:='role';reason:='role-changed';
  WHEN 'workspace.change' THEN expected_kind:='workspace';reason:='workspace-changed';
  WHEN 'record.access' THEN expected_kind:='record';reason:='record-access-changed';
  WHEN 'identity.access' THEN expected_kind:='identity';reason:='identity-access-changed';
  WHEN 'audit.export' THEN expected_kind:='request';reason:='audit-authorized';outcome:='allowed';
  WHEN 'access.allow' THEN expected_kind:='request';reason:='authorization-allowed';outcome:='allowed';
  WHEN 'access.deny' THEN expected_kind:='request';reason:='authorization-denied';outcome:='denied';
  ELSE RAISE EXCEPTION 'Unregistered audit action';
 END CASE;
 IF p_subject_kind IS DISTINCT FROM expected_kind THEN RAISE EXCEPTION 'Audit subject mismatch'; END IF;
 INSERT INTO garden_control.audit_heads(workspace_id) VALUES(p_workspace) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT h FROM garden_control.audit_heads WHERE workspace_id=p_workspace FOR UPDATE;
 actor_ref:=garden_control.audit_alias(p_workspace,p_actor_kind,p_actor);
 request_ref:=garden_control.audit_request(p_request);
 IF p_subject_kind='identity' THEN subject_ref:=garden_control.audit_alias(p_workspace,'subject',p_subject);
 ELSIF p_subject_kind='request' THEN subject_ref:=request_ref;
 ELSE
  IF p_subject IS NULL OR p_subject !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Audit subject unavailable'; END IF;
  subject_ref:=p_subject::uuid;
 END IF;
 e:=jsonb_build_object('schemaVersion',1,'eventId',gen_random_uuid(),'workspaceId',p_workspace,'sequence',(h.sequence+1)::text,'requestId',request_ref,
  'occurredAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'actor',jsonb_build_object('kind',p_actor_kind,'reference',actor_ref),'subject',jsonb_build_object('kind',p_subject_kind,'reference',subject_ref,'version',CASE WHEN p_version IS NULL THEN NULL ELSE p_version::text END),
  'action',p_action,'outcome',outcome,'reasonCode',reason);
 serialized:=e::text;
 digest:=encode(sha256(convert_to('garden-audit-v1'||chr(10)||p_workspace::text||chr(10)||(h.sequence+1)::text||chr(10)||h.hash||chr(10)||serialized,'UTF8')),'hex');
 INSERT INTO garden_control.audit_events VALUES(p_workspace,h.sequence+1,h.hash,digest,serialized);
 UPDATE garden_control.audit_heads SET sequence=h.sequence+1,hash=digest WHERE workspace_id=p_workspace;
 RETURN h.sequence+1;
END $$;
REVOKE ALL ON FUNCTION garden_control.review_actor(uuid,uuid),garden_control.review_role(uuid,text,text[]),garden_control.review_evidence_valid(uuid,jsonb),garden_control.register_review_scope(uuid,uuid,uuid,bigint),garden_control.assign_scoped_reviewer(uuid,uuid,text,text),garden_control.scoped_assignment_current(uuid,uuid,uuid,text,text),garden_control.scoped_review_snapshot(uuid,uuid),garden_control.record_scoped_status(uuid,uuid,text,jsonb),garden_control.scoped_review_history(uuid,uuid,bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION garden_control.register_review_scope(uuid,uuid,uuid,bigint),garden_control.assign_scoped_reviewer(uuid,uuid,text,text),garden_control.scoped_review_snapshot(uuid,uuid),garden_control.record_scoped_status(uuid,uuid,text,jsonb),garden_control.scoped_review_history(uuid,uuid,bigint,integer) TO garden_research;
RESET ROLE;
