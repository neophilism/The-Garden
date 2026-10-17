import {createHash} from 'node:crypto';
import {imageEvidenceDigest} from '../../packages/domain/src/historical/image-reconciliation.mjs';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function manifest({editionId='synthetic-current',documentId='synthetic-document',mediaCount=2,placements=3,documentHash=hash('synthetic current DOCX'),bytesPrefix='bytes'}={}){
 const document={editionId,documentId,sha256:documentHash,size:1234};
 const media=Array.from({length:mediaCount},(_,i)=>({memberPath:`word/media/image${i}.png`,sha256:hash(bytesPrefix+i),size:10,contentType:'image/png'}));
 const ps=Array.from({length:placements},(_,i)=>{
  const m=media[i%mediaCount],part='word/document.xml',locator=`/synthetic-image[${i+1}]`;
  return {placementId:hash(documentHash+'\n'+part+'\n'+locator),part,locator,relationshipId:'r'+i,kind:'drawingml',status:'resolved',target:m.memberPath.slice(5),memberPath:m.memberPath,sha256:m.sha256,alternative:null,
   metadata:[{kind:'document-properties',locator:locator+'/properties',altText:'Original alternative text',title:'Original title'}],crops:[],extents:[]};
 });
 return {profile:'garden-docx-media-v1',document,media,placements:ps,findings:[],counts:{mediaMembers:media.length,distinctByteAssets:mediaCount,storedPlacements:placements,resolvedPlacements:placements,renderedPlacements:null}};
}
export function legacy(man=manifest(),{snapshotId='synthetic-legacy',documentHash=man.document.sha256,assetCount=man.media.length,placementCount=man.placements.length}={}){
 return {snapshotId,artifactSha256:hash('synthetic database'),
  documents:[{coordinate:'rowid:1',record:{id:'legacy-document',role:'manuscript',filename:'old.docx',library_id:null,sha256:documentHash,size_bytes:1234,edition:man.document.editionId,xml_paragraphs:1,nonempty_units:1}}],
  assets:Array.from({length:assetCount},(_,i)=>({coordinate:'rowid:'+i,record:{sha256:man.media[i%man.media.length].sha256,size_bytes:10,extension:'png',width:null,height:null}})),
  asset_members:Array.from({length:assetCount},(_,i)=>({coordinate:'rowid:'+i,record:{id:'member-'+i,document_id:'legacy-document',member_path:man.media[i%man.media.length].memberPath,asset_sha256:man.media[i%man.media.length].sha256}})),
  image_placements:Array.from({length:placementCount},(_,i)=>{const p=man.placements[i%man.placements.length];return {coordinate:'rowid:'+i,record:{id:'placement-'+i,document_id:'legacy-document',unit_id:null,part:p.part,xpath:p.locator,relationship_id:p.relationshipId,asset_sha256:p.sha256,target:p.target,alt_text:'Original alternative text',title:'Original title',crop_json:null,extent_json:null,kind:'archival',review_state:'verified'}};})};
}
export function annotation(man=manifest(),index=0){
 const p=man.placements[index],evidence=[{sourceSha256:hash('synthetic rights evidence'),namespace:'synthetic-review',coordinate:'rowid:1'}];
 return {annotationId:'synthetic-annotation-'+index,binding:{editionId:man.document.editionId,documentSha256:man.document.sha256,memberPath:p.memberPath,sha256:p.sha256,placementId:p.placementId},mediaClass:'archival-image',label:'Archival image',caption:'Source-bound candidate caption',altText:'Description of the pictured object',inferenceLimit:'No identity is inferred from appearance.',permittedArgument:'Documented image context only.',creator:'Recorded creator',title:'Recorded title',dates:'Recorded date',repository:'Recorded repository',identifiers:'Item 1',itemUrl:'https://example.invalid/item/1',imageUrl:'https://example.invalid/media/1',rights:{status:'claimed-public-domain',statement:'Synthetic rights statement, not a real license.',accessedAt:'2026-10-17',evidence},pricing:{amountMinor:null,currency:null,note:'Cost could not be ascertained.'},transformations:[],evidence};
}
export function review(a){return {reviewId:'99999999-9999-4999-8999-999999999999',annotationDigest:imageEvidenceDigest(a),documentSha256:a.binding.documentSha256,mediaSha256:a.binding.sha256,placementId:a.binding.placementId,revoked:false,expiresAt:'2099-01-01T00:00:00Z',rights:'approved',consent:'approved',historical:'approved',privacy:'approved',derivative:'approved'};}
