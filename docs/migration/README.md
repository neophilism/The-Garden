# CP-017 complete table-disposition matrix

This is a proposed migration mapping over the actually inspected schema. No website migration was executed. Preserve raw rows for every table before normalization; all rows are accounted for here, not certified as historical facts.

| Source table | Rows | Proposed domain | Initial access |
|---|---:|---|---|
| `access_log` | 83 | sources_and_inspections | restricted_pending_rights |
| `archival_items` | 13 | sources_and_inspections | restricted_pending_rights |
| `artifact_recoveries` | 2 | lineage_and_recovery | audit_restricted |
| `assertion_placements` | 24 | claims_and_reviews | review_required |
| `assertions` | 78 | claims_and_reviews | review_required |
| `asset_members` | 567 | assets_and_placements | restricted_pending_rights |
| `assets` | 567 | assets_and_placements | restricted_pending_rights |
| `audit_issues` | 34 | research_work_management | review_required |
| `canonical_code_definitions` | 87 | citations_and_authorities | editorial_restricted |
| `checkpoint_documents` | 42 | lineage_and_recovery | audit_restricted |
| `checkpoint_review_status` | 25 | lineage_and_recovery | audit_restricted |
| `citation_repairs_cp008` | 94 | citations_and_authorities | editorial_restricted |
| `claim_adjudications_cp010` | 14 | claims_and_reviews | review_required |
| `claim_adjudications_cp011` | 1 | claims_and_reviews | review_required |
| `claim_candidates` | 40,183 | claims_and_reviews | review_required |
| `claim_current_placements_cp009` | 24 | claims_and_reviews | review_required |
| `claim_current_placements_cp010` | 4 | claims_and_reviews | review_required |
| `claim_current_placements_cp011` | 4 | claims_and_reviews | review_required |
| `claim_segments_cp009` | 24 | claims_and_reviews | review_required |
| `code_authorities` | 89 | citations_and_authorities | editorial_restricted |
| `code_definitions` | 87 | citations_and_authorities | editorial_restricted |
| `code_mentions` | 3,899 | citations_and_authorities | editorial_restricted |
| `code_occurrence_offset_maps` | 1,499 | citations_and_authorities | editorial_restricted |
| `code_occurrences_v2` | 1,515 | citations_and_authorities | editorial_restricted |
| `code_source_links` | 31 | citations_and_authorities | editorial_restricted |
| `code_use_candidates` | 1,604 | citations_and_authorities | editorial_restricted |
| `code_use_reconciliation` | 1,604 | citations_and_authorities | editorial_restricted |
| `collection_census` | 31 | sources_and_inspections | restricted_pending_rights |
| `compound_source_uses` | 67 | citations_and_authorities | editorial_restricted |
| `corpus_checkpoints` | 10 | lineage_and_recovery | audit_restricted |
| `corrections_cp009` | 55 | lineage_and_recovery | audit_restricted |
| `corrections_cp010` | 53 | lineage_and_recovery | audit_restricted |
| `corrections_cp011` | 41 | lineage_and_recovery | audit_restricted |
| `corrections_cp012` | 5 | lineage_and_recovery | audit_restricted |
| `corrections_cp013` | 7 | lineage_and_recovery | audit_restricted |
| `corrections_cp015` | 4 | lineage_and_recovery | audit_restricted |
| `corrections_cp016` | 5 | lineage_and_recovery | audit_restricted |
| `corrections_cp017` | 5 | lineage_and_recovery | audit_restricted |
| `coverage_cells` | 22,400 | research_work_management | review_required |
| `cp017_reconstruction_exceptions` | 1 | lineage_and_recovery | audit_restricted |
| `current_code_occurrences` | 1,499 | citations_and_authorities | editorial_restricted |
| `current_document_units` | 41,442 | document_structure | editorial_restricted |
| `current_reference_occurrences` | 48 | document_structure | editorial_restricted |
| `current_structure_audit` | 21 | document_structure | editorial_restricted |
| `current_table_cells` | 26,712 | document_structure | editorial_restricted |
| `current_text_representations` | 41,442 | document_structure | editorial_restricted |
| `current_unit_structure` | 41,442 | document_structure | editorial_restricted |
| `database_recovery_cp012` | 1 | lineage_and_recovery | audit_restricted |
| `document_note_navigation` | 43 | citations_and_authorities | editorial_restricted |
| `documents` | 12 | document_structure | editorial_restricted |
| `edition_code_definitions` | 917 | citations_and_authorities | editorial_restricted |
| `edition_code_occurrences` | 20,791 | citations_and_authorities | editorial_restricted |
| `edition_current_units` | 421,084 | document_structure | editorial_restricted |
| `editorial_comment_anchors` | 78 | editorial_only | editorial_restricted |
| `editorial_comment_links` | 26 | editorial_only | editorial_restricted |
| `editorial_comment_paragraphs` | 130 | editorial_only | editorial_restricted |
| `editorial_comments` | 26 | editorial_only | editorial_restricted |
| `editorial_drafts` | 1 | document_structure | editorial_restricted |
| `editorial_paragraphs` | 50 | document_structure | editorial_restricted |
| `entities` | 116 | entities_and_dossiers | review_required |
| `entity_current_placements` | 116 | entities_and_dossiers | review_required |
| `evidence` | 69 | claims_and_reviews | review_required |
| `external_corrections` | 1 | external_records | restricted_pending_rights |
| `external_datasets` | 1 | external_records | restricted_pending_rights |
| `external_record_checks` | 14 | external_records | restricted_pending_rights |
| `external_records` | 161,790 | external_records | restricted_pending_rights |
| `extraction_reconciliation` | 709 | document_structure | editorial_restricted |
| `gates` | 10 | research_work_management | review_required |
| `handoff_findings` | 18 | editorial_only | editorial_restricted |
| `image_placements` | 591 | assets_and_placements | restricted_pending_rights |
| `integration_additions` | 415 | lineage_and_recovery | audit_restricted |
| `integration_applications` | 42 | lineage_and_recovery | audit_restricted |
| `legacy_code_hit_adjudications` | 115 | citations_and_authorities | editorial_restricted |
| `manual_reference_bindings` | 43 | citations_and_authorities | editorial_restricted |
| `marinerito_collation_cp012` | 25 | witness_sequences | review_required |
| `marinerito_collation_cp013` | 25 | witness_sequences | review_required |
| `marinerito_collation_cp014` | 25 | witness_sequences | review_required |
| `marinerito_collation_cp015` | 25 | witness_sequences | review_required |
| `marinerito_collation_cp016` | 25 | witness_sequences | review_required |
| `marinerito_collation_cp017` | 25 | witness_sequences | review_required |
| `note_definitions` | 396 | citations_and_authorities | editorial_restricted |
| `note_navigation_cp009` | 43 | citations_and_authorities | editorial_restricted |
| `note_navigation_cp010` | 43 | citations_and_authorities | editorial_restricted |
| `note_navigation_cp011` | 43 | citations_and_authorities | editorial_restricted |
| `page_inspections` | 114 | sources_and_inspections | restricted_pending_rights |
| `polity_dossier_sections` | 8 | entities_and_dossiers | review_required |
| `polity_review_candidates` | 1 | entities_and_dossiers | review_required |
| `proposed_edits` | 8 | claims_and_reviews | review_required |
| `provisional_sequence_rows` | 175 | witness_sequences | review_required |
| `reading_records` | 40 | sources_and_inspections | restricted_pending_rights |
| `research_files` | 129 | sources_and_inspections | restricted_pending_rights |
| `retrieval_attempts` | 17 | sources_and_inspections | restricted_pending_rights |
| `schema_meta` | 15 | lineage_and_recovery | audit_restricted |
| `search_log` | 30 | sources_and_inspections | restricted_pending_rights |
| `sequence_progress` | 6 | witness_sequences | review_required |
| `sequence_reviews` | 8 | witness_sequences | review_required |
| `source_group_reviews` | 7 | sources_and_inspections | restricted_pending_rights |
| `source_occurrences` | 1,766 | sources_and_inspections | restricted_pending_rights |
| `source_relationships` | 5 | sources_and_inspections | restricted_pending_rights |
| `source_shorthand_records` | 10 | sources_and_inspections | restricted_pending_rights |
| `sources` | 1,033 | sources_and_inspections | restricted_pending_rights |
| `status_history` | 104 | research_work_management | review_required |
| `tables_inventory` | 2,267 | document_structure | editorial_restricted |
| `tasks` | 191 | research_work_management | review_required |
| `unit_lineage` | 40,993 | document_structure | editorial_restricted |
| `units` | 40,993 | document_structure | editorial_restricted |

## access_log

Rows: 83. Raw namespace: `legacy_cp017.access_log`.

Columns: `id`, `url`, `checked_on`, `method`, `result`, `locator`, `note`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## archival_items

Rows: 13. Raw namespace: `legacy_cp017.archival_items`.

Columns: `id`, `source_id`, `parent_source_id`, `reference_code`, `title`, `raw_metadata_json`, `download_url`, `review_state`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## artifact_recoveries

Rows: 2. Raw namespace: `legacy_cp017.artifact_recoveries`.

Columns: `id`, `source_name`, `report_json`, `status`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## assertion_placements

Rows: 24. Raw namespace: `legacy_cp017.assertion_placements`.

Columns: `id`, `assertion_id`, `unit_id`, `start_offset`, `end_offset`, `status`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## assertions

Rows: 78. Raw namespace: `legacy_cp017.assertions`.

Columns: `id`, `wording`, `entity_id`, `claim_type`, `temporal_scope`, `geographic_scope`, `status`, `judgment`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## asset_members

Rows: 567. Raw namespace: `legacy_cp017.asset_members`.

Columns: `id`, `document_id`, `member_path`, `asset_sha256`.

**Mapping:** Preserve legacy asset/placement tables as their own snapshot. Reconcile newest DOCX bytes separately; legacy counts are not latest counts.

**Validation:** Compare hashes, asset-versus-placement identity, captions, alt text and item-level rights; no appearance-based relabeling.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## assets

Rows: 567. Raw namespace: `legacy_cp017.assets`.

Columns: `sha256`, `size_bytes`, `extension`, `width`, `height`.

**Mapping:** Preserve legacy asset/placement tables as their own snapshot. Reconcile newest DOCX bytes separately; legacy counts are not latest counts.

**Validation:** Compare hashes, asset-versus-placement identity, captions, alt text and item-level rights; no appearance-based relabeling.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## audit_issues

Rows: 34. Raw namespace: `legacy_cp017.audit_issues`.

Columns: `id`, `severity`, `document_id`, `unit_id`, `category`, `observation`, `action`, `status`.

**Mapping:** Map original scope and status with evidence. Keep ten research gates independent from software milestones and avoid manufactured completion percentages.

**Validation:** Check imported states and denominators; gate 1 alone is closed in baseline; separate unsearched/inaccessible/no-find states.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## canonical_code_definitions

Rows: 87. Raw namespace: `legacy_cp017.canonical_code_definitions`.

Columns: `id`, `legacy_definition_id`, `code`, `current_unit_id`, `current_definition`, `current_text`, `legacy_definition`, `reconciliation_state`, `inherited_review_state`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## checkpoint_documents

Rows: 42. Raw namespace: `legacy_cp017.checkpoint_documents`.

Columns: `checkpoint`, `role`, `filename`, `sha256`, `size_bytes`, `verification`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## checkpoint_review_status

Rows: 25. Raw namespace: `legacy_cp017.checkpoint_review_status`.

Columns: `checkpoint`, `review_kind`, `status`, `scope`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## citation_repairs_cp008

Rows: 94. Raw namespace: `legacy_cp017.citation_repairs_cp008`.

Columns: `id`, `kind`, `role`, `baseline_xpath`, `before_text`, `after_text`, `detail_json`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## claim_adjudications_cp010

Rows: 14. Raw namespace: `legacy_cp017.claim_adjudications_cp010`.

Columns: `id`, `assertion_id`, `prior_status`, `current_status`, `decision`, `source_scope`, `remaining_limit`, `checkpoint`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## claim_adjudications_cp011

Rows: 1. Raw namespace: `legacy_cp017.claim_adjudications_cp011`.

Columns: `id`, `assertion_id`, `prior_status`, `current_status`, `decision`, `source_scope`, `remaining_limit`, `checkpoint`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## claim_candidates

Rows: 40,183. Raw namespace: `legacy_cp017.claim_candidates`.

Columns: `id`, `unit_id`, `risk_flags`, `state`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## claim_current_placements_cp009

Rows: 24. Raw namespace: `legacy_cp017.claim_current_placements_cp009`.

Columns: `id`, `assertion_id`, `edition_unit_id`, `start_offset`, `end_offset`, `exact_span`, `status`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## claim_current_placements_cp010

Rows: 4. Raw namespace: `legacy_cp017.claim_current_placements_cp010`.

Columns: `id`, `assertion_id`, `edition_unit_id`, `start_offset`, `end_offset`, `exact_span`, `status`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## claim_current_placements_cp011

Rows: 4. Raw namespace: `legacy_cp017.claim_current_placements_cp011`.

Columns: `id`, `assertion_id`, `edition_unit_id`, `start_offset`, `end_offset`, `exact_span`, `status`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## claim_segments_cp009

Rows: 24. Raw namespace: `legacy_cp017.claim_segments_cp009`.

Columns: `id`, `assertion_id`, `parent_unit_id`, `parent_edition`, `start_offset`, `end_offset`, `exact_span`, `proposition`, `review_state`, `reason`, `checkpoint`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## code_authorities

Rows: 89. Raw namespace: `legacy_cp017.code_authorities`.

Columns: `code`, `definition_ids_json`, `definition_variants_json`, `bibliographic_scope`, `source_ids_json`, `status`, `open_requirements`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## code_definitions

Rows: 87. Raw namespace: `legacy_cp017.code_definitions`.

Columns: `id`, `code`, `unit_id`, `definition`, `status`, `canonical_note`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## code_mentions

Rows: 3,899. Raw namespace: `legacy_cp017.code_mentions`.

Columns: `id`, `unit_id`, `code`, `offset`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## code_occurrence_offset_maps

Rows: 1,499. Raw namespace: `legacy_cp017.code_occurrence_offset_maps`.

Columns: `legacy_occurrence_id`, `new_occurrence_id`, `old_start`, `old_end`, `new_start`, `new_end`, `status`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## code_occurrences_v2

Rows: 1,515. Raw namespace: `legacy_cp017.code_occurrences_v2`.

Columns: `id`, `code`, `unit_id`, `start_offset`, `end_offset`, `usage_kind`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## code_source_links

Rows: 31. Raw namespace: `legacy_cp017.code_source_links`.

Columns: `id`, `code`, `source_id`, `binding_basis`, `locator`, `scope_limit`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## code_use_candidates

Rows: 1,604. Raw namespace: `legacy_cp017.code_use_candidates`.

Columns: `id`, `code`, `unit_id`, `start_offset`, `end_offset`, `status`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## code_use_reconciliation

Rows: 1,604. Raw namespace: `legacy_cp017.code_use_reconciliation`.

Columns: `legacy_use_id`, `current_occurrence_id`, `mapping_status`, `reason`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## collection_census

Rows: 31. Raw namespace: `legacy_cp017.collection_census`.

Columns: `id`, `title`, `repository`, `url`, `source_languages`, `region`, `trade_system`, `period`, `destination`, `evidence_type`, `access_state`, `inspection_depth`, `next_action`, `notes`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## compound_source_uses

Rows: 67. Raw namespace: `legacy_cp017.compound_source_uses`.

Columns: `id`, `unit_id`, `exact_form`, `start_offset`, `end_offset`, `component_codes_json`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corpus_checkpoints

Rows: 10. Raw namespace: `legacy_cp017.corpus_checkpoints`.

Columns: `checkpoint`, `version`, `parent_version`, `parent_database_sha256`, `created_at_utc`, `scope`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corrections_cp009

Rows: 55. Raw namespace: `legacy_cp017.corrections_cp009`.

Columns: `id`, `role`, `part`, `xpath`, `before_text`, `after_text`, `kind`, `checkpoint`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corrections_cp010

Rows: 53. Raw namespace: `legacy_cp017.corrections_cp010`.

Columns: `id`, `role`, `part`, `xpath`, `before_text`, `after_text`, `kind`, `checkpoint`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corrections_cp011

Rows: 41. Raw namespace: `legacy_cp017.corrections_cp011`.

Columns: `id`, `role`, `part`, `xpath`, `before_text`, `after_text`, `kind`, `checkpoint`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corrections_cp012

Rows: 5. Raw namespace: `legacy_cp017.corrections_cp012`.

Columns: `id`, `document_scope`, `correction`, `evidence`, `status`, `checkpoint`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corrections_cp013

Rows: 7. Raw namespace: `legacy_cp017.corrections_cp013`.

Columns: `id`, `scope`, `action`, `evidence`, `status`, `checkpoint`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corrections_cp015

Rows: 4. Raw namespace: `legacy_cp017.corrections_cp015`.

Columns: `action`, `checkpoint`, `evidence`, `id`, `limits`, `scope`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corrections_cp016

Rows: 5. Raw namespace: `legacy_cp017.corrections_cp016`.

Columns: `action`, `checkpoint`, `evidence`, `id`, `limits`, `scope`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## corrections_cp017

Rows: 5. Raw namespace: `legacy_cp017.corrections_cp017`.

Columns: `id`, `scope`, `action`, `evidence`, `limits`, `checkpoint`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## coverage_cells

Rows: 22,400. Raw namespace: `legacy_cp017.coverage_cells`.

Columns: `id`, `region`, `period`, `trade_system`, `destination`, `evidence_type`, `status`, `rationale`.

**Mapping:** Map original scope and status with evidence. Keep ten research gates independent from software milestones and avoid manufactured completion percentages.

**Validation:** Check imported states and denominators; gate 1 alone is closed in baseline; separate unsearched/inaccessible/no-find states.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## cp017_reconstruction_exceptions

Rows: 1. Raw namespace: `legacy_cp017.cp017_reconstruction_exceptions`.

Columns: `table_name`, `expected_rows`, `actual_lines`, `expected_sha256`, `actual_sha256`, `size_bytes`, `action`, `checkpoint`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## current_code_occurrences

Rows: 1,499. Raw namespace: `legacy_cp017.current_code_occurrences`.

Columns: `id`, `code`, `unit_id`, `start_offset`, `end_offset`, `usage_kind`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## current_document_units

Rows: 41,442. Raw namespace: `legacy_cp017.current_document_units`.

Columns: `id`, `checkpoint`, `role`, `part`, `xpath`, `text`, `style`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## current_reference_occurrences

Rows: 48. Raw namespace: `legacy_cp017.current_reference_occurrences`.

Columns: `id`, `role`, `part`, `xpath`, `unit_id`, `kind`, `target`, `status`, `payload_json`, `checkpoint`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## current_structure_audit

Rows: 21. Raw namespace: `legacy_cp017.current_structure_audit`.

Columns: `id`, `role`, `part`, `payload_json`, `checkpoint`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## current_table_cells

Rows: 26,712. Raw namespace: `legacy_cp017.current_table_cells`.

Columns: `id`, `role`, `part`, `table_xpath`, `row_index`, `cell_index`, `grid_span`, `vertical_merge`, `unit_ids_json`, `checkpoint`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## current_text_representations

Rows: 41,442. Raw namespace: `legacy_cp017.current_text_representations`.

Columns: `unit_id`, `text_with_controls`, `text_sha256`, `legacy_text_sha256`, `insertions_json`, `extraction_rule`, `checkpoint`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## current_unit_structure

Rows: 41,442. Raw namespace: `legacy_cp017.current_unit_structure`.

Columns: `unit_id`, `table_xpath`, `cell_xpath`, `style`, `nested_paragraphs`, `tracked_insertions`, `tracked_deletions`, `exact_text_check`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## database_recovery_cp012

Rows: 1. Raw namespace: `legacy_cp017.database_recovery_cp012`.

Columns: `id`, `source_path`, `observed_size`, `declared_page_count`, `page_size`, `declared_size`, `normal_read`, `immutable_read`, `recovery_method`, `limits`, `checkpoint`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## document_note_navigation

Rows: 43. Raw namespace: `legacy_cp017.document_note_navigation`.

Columns: `reference_id`, `note_definition_id`, `book_filename`, `apparatus_filename`, `bookmark`, `label`, `section_heading`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## documents

Rows: 12. Raw namespace: `legacy_cp017.documents`.

Columns: `id`, `role`, `filename`, `library_id`, `sha256`, `size_bytes`, `edition`, `xml_paragraphs`, `nonempty_units`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## edition_code_definitions

Rows: 917. Raw namespace: `legacy_cp017.edition_code_definitions`.

Columns: `id`, `edition`, `code`, `unit_id`, `definition_text`, `previous_definition_id`, `review_state`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## edition_code_occurrences

Rows: 20,791. Raw namespace: `legacy_cp017.edition_code_occurrences`.

Columns: `id`, `edition`, `unit_id`, `code`, `start_offset`, `end_offset`, `usage_kind`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## edition_current_units

Rows: 421,084. Raw namespace: `legacy_cp017.edition_current_units`.

Columns: `id`, `edition`, `role`, `part`, `xpath`, `text_with_controls`, `previous_unit_id`, `checkpoint`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## editorial_comment_anchors

Rows: 78. Raw namespace: `legacy_cp017.editorial_comment_anchors`.

Columns: `id`, `comment_id`, `unit_id`, `marker_kind`, `xpath`, `rich_text_offset`, `status`.

**Mapping:** Preserve editorial comments, anchors and handoff concerns outside source testimony or current-public-claim text.

**Validation:** Check exact old/replacement text, author/date, anchor bounds and nonpublication by default.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## editorial_comment_links

Rows: 26. Raw namespace: `legacy_cp017.editorial_comment_links`.

Columns: `id`, `comment_id`, `application_id`, `basis`.

**Mapping:** Preserve editorial comments, anchors and handoff concerns outside source testimony or current-public-claim text.

**Validation:** Check exact old/replacement text, author/date, anchor bounds and nonpublication by default.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## editorial_comment_paragraphs

Rows: 130. Raw namespace: `legacy_cp017.editorial_comment_paragraphs`.

Columns: `id`, `comment_id`, `ordinal`, `xpath`, `text`, `text_sha256`.

**Mapping:** Preserve editorial comments, anchors and handoff concerns outside source testimony or current-public-claim text.

**Validation:** Check exact old/replacement text, author/date, anchor bounds and nonpublication by default.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## editorial_comments

Rows: 26. Raw namespace: `legacy_cp017.editorial_comments`.

Columns: `id`, `role`, `comment_xml_id`, `author`, `initials`, `recorded_date`, `body_text`, `source_part`, `source_xpath`, `document_sha256`, `status`, `checkpoint`.

**Mapping:** Preserve editorial comments, anchors and handoff concerns outside source testimony or current-public-claim text.

**Validation:** Check exact old/replacement text, author/date, anchor bounds and nonpublication by default.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## editorial_drafts

Rows: 1. Raw namespace: `legacy_cp017.editorial_drafts`.

Columns: `id`, `title`, `status`, `word_count`, `page_count`, `source_review`, `sha256`, `checkpoint`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## editorial_paragraphs

Rows: 50. Raw namespace: `legacy_cp017.editorial_paragraphs`.

Columns: `id`, `draft_id`, `text`, `note_ids_json`, `status`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## entities

Rows: 116. Raw namespace: `legacy_cp017.entities`.

Columns: `id`, `label`, `entity_type`, `registry_class`, `origin_unit_id`, `source_row_json`, `review_state`.

**Mapping:** Map with original entity type and candidate status. Separate 116 inherited entities from the named 104-candidate roster; preserve unknown/umbrella classifications.

**Validation:** Check types, aliases, candidate admission evidence and reversible placement mapping.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## entity_current_placements

Rows: 116. Raw namespace: `legacy_cp017.entity_current_placements`.

Columns: `entity_id`, `current_unit_id`, `recorded_text`, `relationship`, `scope_limit`, `checkpoint`.

**Mapping:** Map with original entity type and candidate status. Separate 116 inherited entities from the named 104-candidate roster; preserve unknown/umbrella classifications.

**Validation:** Check types, aliases, candidate admission evidence and reversible placement mapping.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## evidence

Rows: 69. Raw namespace: `legacy_cp017.evidence`.

Columns: `id`, `assertion_id`, `source_id`, `unit_id`, `locator`, `relation`, `evidence_class`, `independence_group`, `access_date`, `note`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## external_corrections

Rows: 1. Raw namespace: `legacy_cp017.external_corrections`.

Columns: `id`, `dataset_id`, `row_number`, `field`, `raw_value`, `proposed_value`, `source_id`, `basis`, `status`.

**Mapping:** Preserve all source registration rows and corrections with dataset/version identifiers. Never equate a row with a unique person; retain the CP-016 non-equivalence warning.

**Validation:** Compare raw field values, NULLs, types, row counts, original inventory values and separately applied corrections.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## external_datasets

Rows: 1. Raw namespace: `legacy_cp017.external_datasets`.

Columns: `id`, `title`, `repository`, `source_url`, `download_url`, `access_date`, `file_name`, `sha256`, `row_count`, `fields_json`, `record_unit`, `rights_state`, `inspection_state`, `limitations`.

**Mapping:** Preserve all source registration rows and corrections with dataset/version identifiers. Never equate a row with a unique person; retain the CP-016 non-equivalence warning.

**Validation:** Compare raw field values, NULLs, types, row counts, original inventory values and separately applied corrections.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## external_record_checks

Rows: 14. Raw namespace: `legacy_cp017.external_record_checks`.

Columns: `dataset_id`, `row_number`, `check_kind`, `result`, `note`.

**Mapping:** Preserve all source registration rows and corrections with dataset/version identifiers. Never equate a row with a unique person; retain the CP-016 non-equivalence warning.

**Validation:** Compare raw field values, NULLs, types, row counts, original inventory values and separately applied corrections.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## external_records

Rows: 161,790. Raw namespace: `legacy_cp017.external_records`.

Columns: `dataset_id`, `row_number`, `source_record_id`, `raw_json`, `record_sha256`, `review_state`.

**Mapping:** Preserve all source registration rows and corrections with dataset/version identifiers. Never equate a row with a unique person; retain the CP-016 non-equivalence warning.

**Validation:** Compare raw field values, NULLs, types, row counts, original inventory values and separately applied corrections.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## extraction_reconciliation

Rows: 709. Raw namespace: `legacy_cp017.extraction_reconciliation`.

Columns: `id`, `baseline_unit_id`, `current_unit_id`, `old_relation`, `new_relation`, `basis`, `checkpoint`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## gates

Rows: 10. Raw namespace: `legacy_cp017.gates`.

Columns: `number`, `title`, `status`, `completion_test`.

**Mapping:** Map original scope and status with evidence. Keep ten research gates independent from software milestones and avoid manufactured completion percentages.

**Validation:** Check imported states and denominators; gate 1 alone is closed in baseline; separate unsearched/inaccessible/no-find states.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## handoff_findings

Rows: 18. Raw namespace: `legacy_cp017.handoff_findings`.

Columns: `id`, `handoff`, `finding`, `evidence_action`, `status`, `review_note`.

**Mapping:** Preserve editorial comments, anchors and handoff concerns outside source testimony or current-public-claim text.

**Validation:** Check exact old/replacement text, author/date, anchor bounds and nonpublication by default.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## image_placements

Rows: 591. Raw namespace: `legacy_cp017.image_placements`.

Columns: `id`, `document_id`, `unit_id`, `part`, `xpath`, `relationship_id`, `asset_sha256`, `target`, `alt_text`, `title`, `crop_json`, `extent_json`, `kind`, `review_state`.

**Mapping:** Preserve legacy asset/placement tables as their own snapshot. Reconcile newest DOCX bytes separately; legacy counts are not latest counts.

**Validation:** Compare hashes, asset-versus-placement identity, captions, alt text and item-level rights; no appearance-based relabeling.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## integration_additions

Rows: 415. Raw namespace: `legacy_cp017.integration_additions`.

Columns: `id`, `checkpoint`, `role`, `text`, `style`, `verification`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## integration_applications

Rows: 42. Raw namespace: `legacy_cp017.integration_applications`.

Columns: `id`, `checkpoint`, `role`, `part`, `baseline_unit_id`, `baseline_xpath`, `current_xpath`, `original_span`, `replacement_span`, `assertion_id`, `verification`, `payload_json`, `verified_at_utc`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## legacy_code_hit_adjudications

Rows: 115. Raw namespace: `legacy_cp017.legacy_code_hit_adjudications`.

Columns: `legacy_use_id`, `code`, `decision`, `context`, `new_occurrence_id`, `explanation`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## manual_reference_bindings

Rows: 43. Raw namespace: `legacy_cp017.manual_reference_bindings`.

Columns: `reference_id`, `note_definition_id`, `selection_basis`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## marinerito_collation_cp012

Rows: 25. Raw namespace: `legacy_cp017.marinerito_collation_cp012`.

Columns: `row_number`, `tna_number`, `tna_reading`, `tna_age`, `tna_pdf_page`, `slpa_number`, `slpa_reading`, `slpa_age`, `slpa_pdf_page`, `uncertainty_or_conflict`, `review_status`, `checkpoint`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## marinerito_collation_cp013

Rows: 25. Raw namespace: `legacy_cp017.marinerito_collation_cp013`.

Columns: `row_number`, `tna_number`, `tna_reading`, `tna_sex`, `tna_age`, `tna_pdf_page`, `slpa_number`, `slpa_reading`, `slpa_sex`, `slpa_age`, `slpa_pdf_page`, `sequence_alignment_state`, `uncertainty_or_conflict`, `review_status`, `checkpoint`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## marinerito_collation_cp014

Rows: 25. Raw namespace: `legacy_cp017.marinerito_collation_cp014`.

Columns: `row_number`, `tna_number`, `tna_reading`, `tna_sex`, `tna_age`, `tna_pdf_page`, `slpa_number`, `slpa_reading`, `slpa_sex`, `slpa_age`, `slpa_pdf_page`, `sequence_alignment_state`, `uncertainty_or_conflict`, `review_status`, `checkpoint`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## marinerito_collation_cp015

Rows: 25. Raw namespace: `legacy_cp017.marinerito_collation_cp015`.

Columns: `checkpoint`, `review_status`, `row_number`, `sequence_alignment_state`, `slpa_age`, `slpa_number`, `slpa_pdf_page`, `slpa_reading`, `slpa_sex`, `tna_age`, `tna_number`, `tna_pdf_page`, `tna_reading`, `tna_sex`, `uncertainty_or_conflict`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## marinerito_collation_cp016

Rows: 25. Raw namespace: `legacy_cp017.marinerito_collation_cp016`.

Columns: `checkpoint`, `review_status`, `row_number`, `sequence_alignment_state`, `slpa_age`, `slpa_number`, `slpa_pdf_page`, `slpa_reading`, `slpa_sex`, `tna_age`, `tna_number`, `tna_pdf_page`, `tna_reading`, `tna_sex`, `uncertainty_or_conflict`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## marinerito_collation_cp017

Rows: 25. Raw namespace: `legacy_cp017.marinerito_collation_cp017`.

Columns: `row_number`, `tna_number`, `tna_reading`, `tna_sex`, `tna_age`, `tna_pdf_page`, `slpa_number`, `slpa_reading`, `slpa_sex`, `slpa_age`, `slpa_pdf_page`, `sequence_alignment_state`, `uncertainty_or_conflict`, `review_status`, `checkpoint`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## note_definitions

Rows: 396. Raw namespace: `legacy_cp017.note_definitions`.

Columns: `id`, `unit_id`, `label`, `section_heading`, `scope`, `text`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## note_navigation_cp009

Rows: 43. Raw namespace: `legacy_cp017.note_navigation_cp009`.

Columns: `relationship_id`, `previous_target`, `current_target`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## note_navigation_cp010

Rows: 43. Raw namespace: `legacy_cp017.note_navigation_cp010`.

Columns: `relationship_id`, `previous_target`, `current_target`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## note_navigation_cp011

Rows: 43. Raw namespace: `legacy_cp017.note_navigation_cp011`.

Columns: `relationship_id`, `previous_target`, `current_target`, `status`, `checkpoint`.

**Mapping:** Preserve original code/edition namespaces and all literal occurrences. Lexical matches are not certified citations; repeated note numbers remain section-local.

**Validation:** Verify exact spans, 43 companion targets where applicable, unresolved compound references and no automatic source equivalence.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## page_inspections

Rows: 114. Raw namespace: `legacy_cp017.page_inspections`.

Columns: `id`, `file_id`, `page_number`, `locator`, `inspection_kind`, `findings`, `limits`, `inspected_on`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## polity_dossier_sections

Rows: 8. Raw namespace: `legacy_cp017.polity_dossier_sections`.

Columns: `id`, `entity_id`, `section`, `text`, `assertion_ids_json`, `status`, `next_action`.

**Mapping:** Map with original entity type and candidate status. Separate 116 inherited entities from the named 104-candidate roster; preserve unknown/umbrella classifications.

**Validation:** Check types, aliases, candidate admission evidence and reversible placement mapping.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## polity_review_candidates

Rows: 1. Raw namespace: `legacy_cp017.polity_review_candidates`.

Columns: `id`, `label`, `source_id`, `locator`, `evidence_for_collectivity`, `distinction_from_named`, `unresolved_identity`, `status`.

**Mapping:** Map with original entity type and candidate status. Separate 116 inherited entities from the named 104-candidate roster; preserve unknown/umbrella classifications.

**Validation:** Check types, aliases, candidate admission evidence and reversible placement mapping.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## proposed_edits

Rows: 8. Raw namespace: `legacy_cp017.proposed_edits`.

Columns: `id`, `unit_id`, `start_offset`, `end_offset`, `original_text`, `replacement_text`, `assertion_id`, `reason`, `status`.

**Mapping:** Map explicit assertions, candidates, evidence and placements without upgrading review status. Compound candidates are not atomic verified claims.

**Validation:** Check claim type, source locator, assertion versus source statement, contradictions and existing review limits.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## provisional_sequence_rows

Rows: 175. Raw namespace: `legacy_cp017.provisional_sequence_rows`.

Columns: `id`, `sequence_label`, `row_number`, `payload_json`, `status`, `checkpoint`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## reading_records

Rows: 40. Raw namespace: `legacy_cp017.reading_records`.

Columns: `id`, `code`, `source_id`, `title`, `creator_roles`, `publication`, `digital_lineage`, `repository`, `identifier`, `rights_observed`, `access_date`, `inspection_depth`, `inspected_locator`, `limits`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## research_files

Rows: 129. Raw namespace: `legacy_cp017.research_files`.

Columns: `id`, `source_id`, `filename`, `sha256`, `size_bytes`, `media_type`, `access_date`, `rights_state`, `role`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## retrieval_attempts

Rows: 17. Raw namespace: `legacy_cp017.retrieval_attempts`.

Columns: `id`, `url_or_query`, `result`, `inspected_content`, `checkpoint`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## schema_meta

Rows: 15. Raw namespace: `legacy_cp017.schema_meta`.

Columns: `key`, `value`.

**Mapping:** Preserve immutable correction applications, hashes, reconstruction exceptions and recovery boundaries; never replay inherited migrations over the current corpus.

**Validation:** Compare original/replacement strings, checksums, non-equivalence exceptions and applied-versus-proposed status.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## search_log

Rows: 30. Raw namespace: `legacy_cp017.search_log`.

Columns: `id`, `query`, `language`, `endpoint`, `checked_on`, `results_note`, `followup`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## sequence_progress

Rows: 6. Raw namespace: `legacy_cp017.sequence_progress`.

Columns: `id`, `label`, `source_reference`, `known_total`, `unit_type`, `baseline_reported_completed`, `independently_checked`, `status`, `next_action`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## sequence_reviews

Rows: 8. Raw namespace: `legacy_cp017.sequence_reviews`.

Columns: `id`, `sequence_label`, `unit_type`, `known_online_extent`, `downloaded_extent`, `visually_inspected_extent`, `transcribed_extent`, `second_read_extent`, `scope`, `limits`, `as_of`.

**Mapping:** Preserve positional rows, original witness strings, coordinates and alignment hypotheses. Rows 152-326 remain provisional; row-223 displacement is unresolved.

**Validation:** Check accepted/provisional boundary, witness/page transitions, remarks linkage and absence of inferred person identity.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## source_group_reviews

Rows: 7. Raw namespace: `legacy_cp017.source_group_reviews`.

Columns: `code`, `definition_count`, `lexical_unit_count`, `status`, `next_action`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## source_occurrences

Rows: 1,766. Raw namespace: `legacy_cp017.source_occurrences`.

Columns: `id`, `source_id`, `document_id`, `unit_id`, `part`, `locator`, `raw_url`, `method`, `scope`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## source_relationships

Rows: 5. Raw namespace: `legacy_cp017.source_relationships`.

Columns: `id`, `source_id`, `related_source_id`, `relation`, `status`, `note`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## source_shorthand_records

Rows: 10. Raw namespace: `legacy_cp017.source_shorthand_records`.

Columns: `id`, `unit_id`, `exact_form`, `start_offset`, `end_offset`, `proposed_codes_json`, `status`, `note`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## sources

Rows: 1,033. Raw namespace: `legacy_cp017.sources`.

Columns: `id`, `url`, `kind`, `review_state`.

**Mapping:** Map sources, exact representations and inspection scope; preserve access barriers, derivative dependence and discovery-only status.

**Validation:** Check repository/item/version, original locator and read-versus-inspected-versus-reviewed distinctions.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## status_history

Rows: 104. Raw namespace: `legacy_cp017.status_history`.

Columns: `id`, `checkpoint`, `table_name`, `record_id`, `old_status`, `new_status`, `reason`, `changed_at_utc`.

**Mapping:** Map original scope and status with evidence. Keep ten research gates independent from software milestones and avoid manufactured completion percentages.

**Validation:** Check imported states and denominators; gate 1 alone is closed in baseline; separate unsearched/inaccessible/no-find states.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## tables_inventory

Rows: 2,267. Raw namespace: `legacy_cp017.tables_inventory`.

Columns: `id`, `document_id`, `part`, `xpath`, `row_count`, `header_json`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## tasks

Rows: 191. Raw namespace: `legacy_cp017.tasks`.

Columns: `id`, `gate`, `title`, `priority`, `status`, `input_locator`, `completion_test`.

**Mapping:** Map original scope and status with evidence. Keep ten research gates independent from software milestones and avoid manufactured completion percentages.

**Validation:** Check imported states and denominators; gate 1 alone is closed in baseline; separate unsearched/inaccessible/no-find states.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## unit_lineage

Rows: 40,993. Raw namespace: `legacy_cp017.unit_lineage`.

Columns: `baseline_unit_id`, `current_unit_id`, `relation`, `basis_json`, `checkpoint`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.

## units

Rows: 40,993. Raw namespace: `legacy_cp017.units`.

Columns: `id`, `document_id`, `part`, `xpath`, `ordinal`, `style`, `in_table`, `heading_context`, `text`, `text_sha256`, `has_revision`.

**Mapping:** Retain every edition/legacy unit, table and offset. Identify current-edition projection explicitly rather than summing versions as new research.

**Validation:** Check Unicode offset basis, document part, tables/headers/notes, edition identity and round-trip locators.

**Status:** specified_not_executed; owner: Data steward + domain reviewer.
