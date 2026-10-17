import test from 'node:test';
import assert from 'node:assert/strict';
import {validateImageManifest,validateLegacyImageSnapshot,validateImageAnnotation,reconcileImageEditions,imageReleaseEligibility,imageEvidenceDigest} from '../../packages/domain/src/historical/image-reconciliation.mjs';
import {hash,manifest,legacy,annotation,review} from './image-fixtures.mjs';
const reconcile=(m=manifest(),l=legacy(m),annotations=[])=>reconcileImageEditions({editions:[m],legacySnapshot:l,annotations});
const codes=report=>new Set(report.findings.map(f=>f.code));

test('GDN-047-AC01 retains synthetic legacy 567/591 separately from 591/615 edition counts',()=>{
 const m=manifest({mediaCount:591,placements:615}),l=legacy(m,{assetCount:567,placementCount:591,documentHash:hash('older edition bytes')});
 const output=reconcile(m,l);
 assert.deepEqual(output.legacyCounts,{documents:1,assets:567,asset_members:567,image_placements:591});
 assert.equal(output.editions[0].counts.mediaMembers,591);assert.equal(output.editions[0].counts.storedPlacements,615);
 assert.equal(output.legacyDispositions.length,1+567+567+591);assert.ok(codes(output).has('edition-not-in-legacy-snapshot'));
 assert.equal(output.publiclyAccessible,false);assert.equal(output.publicationApproved,false);
});
test('per-edition counts never imply that a previous newest edition is current',()=>{
 const a=manifest({editionId:'synthetic-prior',mediaCount:591,placements:615});
 const b=manifest({editionId:'synthetic-successor',documentHash:hash('successor'),mediaCount:607,placements:630});
 const output=reconcileImageEditions({editions:[a,b],legacySnapshot:legacy(a),annotations:[]});
 assert.deepEqual(output.editions.map(e=>[e.document.editionId,e.counts.mediaMembers,e.counts.storedPlacements]),[['synthetic-prior',591,615],['synthetic-successor',607,630]]);
 assert.equal(output.latestEdition,undefined);
});
test('GDN-047-T01 exact hashes and sizes determine byte matches, never filenames',()=>{
 const m=manifest(),l=legacy(m);l.assets[0].record.sha256=hash('different bytes');l.assets[1].record.size_bytes=11;
 const output=reconcile(m,l);assert.ok(output.editions[0].assets.every(a=>a.exactByteLegacyCoordinates.length===0));
 assert.ok(codes(output).has('media-without-exact-legacy-byte-match'));assert.ok(codes(output).has('no-exact-current-byte-match'));
});
test('GDN-047-T02 identical bytes retain every member, placement and source coordinate',()=>{
 const m=manifest();m.media[1].sha256=m.media[0].sha256;m.placements[1].sha256=m.media[0].sha256;m.counts.distinctByteAssets=1;
 const l=legacy(m);l.image_placements[1].record.id=l.image_placements[0].record.id;
 const output=reconcile(m,l);
 assert.equal(output.editions[0].assets.length,2);assert.equal(output.editions[0].assetPlacements.length,3);assert.equal(output.legacySnapshot.image_placements.length,3);
 assert.ok(codes(output).has('duplicate-legacy-asset-rows'));assert.equal(output.editions[0].assets[0].exactByteLegacyCoordinates.length,2);
});
test('same locator and bytes across changed editions cannot become an exact placement match',()=>{
 const m=manifest(),l=legacy(m,{documentHash:hash('prior DOCX')});
 const output=reconcile(m,l);assert.ok(output.editions[0].assetPlacements.every(p=>p.legacyCoordinates.length===0));
 assert.ok(output.editions[0].assets.every(a=>a.exactByteLegacyCoordinates.length===1));
 assert.ok(codes(output).has('placement-without-exact-edition-locator-match'));
});
test('a repeated legacy document ID in different editions cannot establish placement identity',()=>{
 const m=manifest(),l=legacy(m);l.documents.push({coordinate:'rowid:2',record:{...l.documents[0].record,sha256:hash('another edition')}});
 const output=reconcile(m,l);assert.ok(codes(output).has('duplicate-legacy-identifiers'));assert.ok(output.editions[0].assetPlacements.every(p=>p.legacyCoordinates.length===0));
});
test('annotations never bleed across edition labels even when the underlying DOCX bytes are identical',()=>{
 const a=manifest({editionId:'edition-a'}),b=manifest({editionId:'edition-b'}),note=annotation(a);
 const output=reconcileImageEditions({editions:[a,b],legacySnapshot:null,annotations:[note]});
 assert.equal(output.editions[0].assetPlacements[0].annotationIds.length,1);assert.ok(output.editions[1].assetPlacements.every(p=>p.annotationIds.length===0));
});
test('GDN-047-AC02 source mismatches, duplicate document identities and unmapped coordinates remain explicit',()=>{
 const m=manifest(),l=legacy(m);l.documents.push({coordinate:'rowid:2',record:{...l.documents[0].record,id:'another-id'}});
 l.asset_members[0].record.document_id='absent';l.assets[0].record.sha256=null;
 const output=reconcile(m,l);assert.ok(codes(output).has('ambiguous-legacy-document'));assert.ok(codes(output).has('ambiguous-or-missing-legacy-document'));
 assert.equal(output.legacySnapshot.assets[0].record.sha256,null);assert.equal(output.legacyDispositions.length,9);
});
test('caption/alt/title and crop differences cannot be cleared by byte equality',()=>{
 const m=manifest(),l=legacy(m);l.image_placements[0].record.alt_text='Wrong label';l.image_placements[0].record.title='Wrong title';l.image_placements[0].record.crop_json='{malformed exact source text';
 const output=reconcile(m,l);assert.ok(codes(output).has('placement-alt_text-mismatch'));assert.ok(codes(output).has('placement-title-mismatch'));assert.ok(codes(output).has('legacy-transform-comparison-required'));
 assert.equal(output.legacySnapshot.image_placements[0].record.crop_json,'{malformed exact source text');
 assert.equal(output.editions[0].manifest.placements[0].metadata[0].altText,'Original alternative text');
});
test('inherited verified and archival strings remain preserved assertions without approval',()=>{
 const m=manifest(),l=legacy(m),output=reconcile(m,l);
 assert.equal(output.legacySnapshot.image_placements[0].record.review_state,'verified');assert.equal(output.historicalReview,'unreviewed');
 assert.ok(output.editions[0].assets.every(a=>a.rights==='unreviewed'&&!a.publicBytesAllowed));assert.ok(codes(output).has('media-metadata-and-rights-unresolved'));
});
test('exact provenance, prices, transformations and Unicode are retained with private annotations',()=>{
 const m=manifest(),a=annotation(m);a.caption='  e\u0301 \u0645\u0635\u062f\u0631  ';a.transformations=[{kind:'crop',sourceSha256:hash('uncropped original'),derivativeSha256:a.binding.sha256,parameters:{left:'0.10',units:'fraction-of-original'},evidence:a.evidence}];
 const output=reconcile(m,legacy(m),[a]);assert.deepEqual(output.annotations[0],a);assert.equal(output.annotations[0].pricing.note,'Cost could not be ascertained.');
 a.caption='mutated caller';assert.notEqual(output.annotations[0].caption,a.caption);assert.ok(Object.isFrozen(output.annotations[0]));
});
test('unbound and ambiguous annotation records are visible mismatches, never silently adopted',()=>{
 const m=manifest(),a=annotation(m);a.binding.documentSha256=hash('different doc');const b=annotation(m,1);b.binding.placementId=hash('absent locator');
 const output=reconcile(m,legacy(m),[a,b]);assert.ok(codes(output).has('annotation-without-exact-edition-byte-binding'));assert.ok(codes(output).has('annotation-placement-mismatch'));
 assert.ok(output.editions[0].assetPlacements.every(p=>p.annotationIds.length===0));
});
test('generated/archival contradictions and missing reconstruction labels remain explicit',()=>{
 const m=manifest(),a=annotation(m),b={...annotation(m),annotationId:'other',mediaClass:'generated-illustration',label:null};
 const output=reconcile(m,legacy(m),[a,b]);assert.ok(codes(output).has('contradictory-image-classification'));assert.ok(codes(output).has('generated-or-reconstructed-label-missing'));
});
test('source/derivative mismatch does not authenticate a transformed image',()=>{
 const m=manifest(),a=annotation(m);a.transformations=[{kind:'resize',sourceSha256:hash('original'),derivativeSha256:hash('wrong derivative'),parameters:{width:'300'},evidence:a.evidence}];
 assert.ok(codes(reconcile(m,legacy(m),[a])).has('derivative-byte-binding-mismatch'));
 assert.equal(imageReleaseEligibility(a,review(a),{documentSha256:a.binding.documentSha256,mediaSha256:a.binding.sha256,placementId:a.binding.placementId}).eligible,false);
});
test('GDN-047-AC03 unknown rights block even an otherwise approved review receipt',()=>{
 const a=annotation();a.rights.status='unknown';const r=review(a);
 const result=imageReleaseEligibility(a,r,{documentSha256:a.binding.documentSha256,mediaSha256:a.binding.sha256,placementId:a.binding.placementId});assert.equal(result.eligible,false);assert.ok(result.reasons.includes('rights-not-established'));assert.equal(result.publiclyAccessible,false);
});
test('GDN-047-T03 generated images require an explicit exact reviewed label',()=>{
 const a=annotation();a.mediaClass='generated-illustration';a.label=null;
 const scope={documentSha256:a.binding.documentSha256,mediaSha256:a.binding.sha256,placementId:a.binding.placementId};
 assert.equal(imageReleaseEligibility(a,review(a),scope).eligible,false);a.label='Generated illustration — not archival evidence';
 assert.equal(imageReleaseEligibility(a,review(a),scope).eligible,true);
});
test('stale caption, revoked review, wrong placement or missing rights evidence denies eligibility',()=>{
 const a=annotation(),r=review(a),scope={documentSha256:a.binding.documentSha256,mediaSha256:a.binding.sha256,placementId:a.binding.placementId};
 assert.equal(imageReleaseEligibility(a,r,scope).eligible,true);
 for(const changed of [{...r,revoked:true},{...r,expiresAt:'2000-01-01T00:00:00Z'},{...r,placementId:hash('other')},{...r,rights:'pending'},null])assert.equal(imageReleaseEligibility(a,changed,scope).eligible,false);
 a.caption='edited caption';assert.equal(imageReleaseEligibility(a,r,scope).eligible,false);
 a.rights.evidence=[];assert.equal(imageReleaseEligibility(a,review(a),scope).eligible,false);
});
test('replay evidence digest is stable while changed original metadata creates a new projection',()=>{
 const m=manifest(),l=legacy(m),first=reconcile(m,l),again=reconcile(structuredClone(m),structuredClone(l));assert.equal(imageEvidenceDigest(first),imageEvidenceDigest(again));
 l.image_placements[0].record.title='changed';assert.notEqual(reconcile(m,l).inputDigest,first.inputDigest);
});
test('falsified counts, placement identity, raw coordinates and publication input are rejected',()=>{
 const m=manifest();m.counts.storedPlacements++;assert.throws(()=>validateImageManifest(m));
 const p=manifest();p.placements[0].placementId=hash('invented');assert.throws(()=>validateImageManifest(p));
 const l=legacy();l.assets[0].coordinate='editorial-row:1';assert.throws(()=>validateLegacyImageSnapshot(l));
 for(const coordinate of ['rowid:-0','rowid:9223372036854775808','rowid:-9223372036854775809']){l.assets[0].coordinate=coordinate;assert.throws(()=>validateLegacyImageSnapshot(l));}
 assert.throws(()=>reconcileImageEditions({editions:[manifest()],legacySnapshot:null,annotations:[],publicationApproved:true}));
 const a=annotation();a.pricing.note='Free because online';assert.throws(()=>validateImageAnnotation(a));
});
test('no legacy snapshot and missing current rights are explicitly incomplete, not a finished migration',()=>{
 const output=reconcile(manifest(),null);assert.equal(output.legacyCounts,null);assert.ok(codes(output).has('legacy-snapshot-not-provided'));assert.equal(output.historicalReview,'unreviewed');
});
