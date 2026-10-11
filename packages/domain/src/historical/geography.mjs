/** Bounded, sourced spatial assertions. Geometry is not historical certainty. */
import {object,text,list,uuid,temporal,freeze} from './model.mjs';
import {revision} from './locators.mjs';
export class GeographyError extends Error{constructor(){super('Geographic assertion unavailable or incompatible');this.code='geography_unavailable';}}
const fail=()=>{throw new GeographyError();};
const guard=work=>{try{return work();}catch{fail();}};
const equal=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,c)=>Math.abs(cross(a,b,c))<1e-10&&c[0]>=Math.min(a[0],b[0])&&c[0]<=Math.max(a[0],b[0])&&c[1]>=Math.min(a[1],b[1])&&c[1]<=Math.max(a[1],b[1]);
function intersects(a,b,c,d){
 const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);
 return (p*q<0&&r*s<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
function inside(point,ring){let yes=false;for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){
 const a=ring[i],b=ring[j];if(on(a,b,point))return false;
 if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }return yes;
}
const ringsIntersect=(a,b)=>a.slice(1).some((p,i)=>b.slice(1).some((q,j)=>intersects(a[i],p,b[j],q)));
const inPolygon=(p,polygon)=>inside(p,polygon[0])&&!polygon.slice(1).some(r=>inside(p,r));
/** Deliberately bounded profile: 2D CRS84, antimeridian-cut, non-touching simple
 * polygon rings. Near-degenerate/touching shapes need specialist normalization;
 * they are refused rather than silently repaired. Original bytes stay intact. */
export function validateGeometry(input){return guard(()=>{
 object(input,['type','coordinates']);let count=0;
 function position(p){if(!Array.isArray(p)||p.length!==2||[p[0],p[1]].some(n=>typeof n!=='number'||!Number.isFinite(n))||Math.abs(p[0])>180||Math.abs(p[1])>=90||++count>2048)fail();}
 function line(points,closed=false){
  list(points,2048,position);if(points.length<(closed?4:2))fail();
  for(let i=1;i<points.length;i++)if(equal(points[i-1],points[i])||Math.abs(points[i-1][0]-points[i][0])>180)fail();
  if(closed){
   if(!equal(points[0],points.at(-1)))fail();let area=0;
   for(let i=0;i<points.length-1;i++){area+=points[i][0]*points[i+1][1]-points[i+1][0]*points[i][1];
    for(let j=i+2;j<points.length-1;j++)if(!(i===0&&j===points.length-2)&&intersects(points[i],points[i+1],points[j],points[j+1]))fail();
   }
   if(Math.abs(area)<1e-10||Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))>180)fail();
  }
 }
 function polygon(rings){
  list(rings,32,r=>line(r,true));if(!rings.length)fail();
  for(let i=1;i<rings.length;i++){
   if(!inside(rings[i][0],rings[0])||ringsIntersect(rings[0],rings[i]))fail();
   for(let j=1;j<i;j++)if(ringsIntersect(rings[i],rings[j])||inside(rings[i][0],rings[j])||inside(rings[j][0],rings[i]))fail();
  }
 }
 switch(input.type){
  case 'Point':position(input.coordinates);break;
  case 'LineString':line(input.coordinates);break;
  case 'Polygon':polygon(input.coordinates);break;
  case 'MultiPolygon':
   list(input.coordinates,32,polygon);if(!input.coordinates.length)fail();
   for(let i=0;i<input.coordinates.length;i++)for(let j=0;j<i;j++){
    const a=input.coordinates[i],b=input.coordinates[j];
    if(a.some(r=>b.some(s=>ringsIntersect(r,s)))||inPolygon(a[0][0],b)||inPolygon(b[0][0],a))fail();
   }break;
  default:fail();
 }
 return freeze(structuredClone(input));
});}
function ref(v){object(v,['id','revision']);uuid(v.id);revision(v.revision);}
export function validateGeographicAssertion(v){return guard(()=>{
 object(v,['recordType','schemaVersion','id','subject','claim','evidence','crs','geometry','validDuring','uncertainty','context','sensitivity','names','rationale']);
 if(v.recordType!=='geographic-assertion'||v.schemaVersion!==1||v.crs!=='OGC:CRS84')fail();uuid(v.id);
 object(v.subject,['id','revision','kind']);ref({id:v.subject.id,revision:v.subject.revision});
 if(!['place','port','polity','people','institution','person'].includes(v.subject.kind))fail();ref(v.claim);
 if(new Set([v.id,v.subject.id,v.claim.id]).size!==3)fail();
 list(v.evidence,32,ref);if(!v.evidence.length||new Set(v.evidence.map(e=>e.id)).size!==v.evidence.length||v.evidence.some(e=>[v.id,v.subject.id,v.claim.id].includes(e.id)))fail();
 temporal(v.validDuring);text(v.rationale,4000);
 if(!['historical-assertion','modern-reference'].includes(v.context)||!['historical','living-person','sensitive-site'].includes(v.sensitivity))fail();
 if(v.context==='modern-reference'&&!['place','port'].includes(v.subject.kind))fail();
 if(v.subject.kind==='person'&&v.sensitivity!=='living-person')fail();
 object(v.uncertainty,['kind','radiusMeters','description']);text(v.uncertainty.description,2000);
 if(!['reported-exact','approximate','disputed','unknown'].includes(v.uncertainty.kind))fail();
 const radius=v.uncertainty.radiusMeters;
 if(radius!==null&&(typeof radius!=='number'||!Number.isFinite(radius)||radius<0||radius>20040000))fail();
 if(v.geometry===null){if(v.uncertainty.kind!=='unknown'||radius!==null)fail();}
 else{validateGeometry(v.geometry);if(v.uncertainty.kind==='unknown'||v.geometry.type!=='Point'&&radius!==null||v.uncertainty.kind==='approximate'&&radius===0)fail();}
 list(v.names,100,n=>{object(n,['value','language','validDuring']);text(n.value,300);text(n.language,80,true);temporal(n.validDuring);});
 if(new TextEncoder().encode(JSON.stringify(v)).length>131072)fail();return freeze(structuredClone(v));
});}
export function compareTemporalExtents(a,b){return guard(()=>{
 temporal(a);temporal(b);
 const al=a.earliestYear,ah=a.latestYear,bl=b.earliestYear,bh=b.latestYear;
 if(ah!==null&&bl!==null&&ah<bl||bh!==null&&al!==null&&bh<al)return 'disjoint';
 if([al,ah,bl,bh].some(x=>x===null))return 'unknown';
 return 'possible-overlap';
});}
export function preserveGeographicIdentity(beforeInput,afterInput){return guard(()=>{
 const before=validateGeographicAssertion(beforeInput),after=validateGeographicAssertion(afterInput);
 if(before.id!==after.id||before.context!==after.context||before.sensitivity!==after.sensitivity||
  ['id','revision','kind'].some(key=>before.subject[key]!==after.subject[key]))fail();
 return after;
});}
/** This is a projection of preauthorized research rows, never an auth check.
 * Withhold all sensitive rows, IDs, names and bounds, even in this future-map
 * adapter. A separate restricted case viewer would need its own design. */
export function researchGeographyLayer(rows,{includeModernReference=false}={}){return guard(()=>{
 if(typeof includeModernReference!=='boolean')fail();list(rows,200,r=>{object(r,['record','revision']);revision(r.revision);validateGeographicAssertion(r.record);});
 if(new Set(rows.map(r=>r.record.id)).size!==rows.length)fail();
 const features=[],unlocated=[];
 for(const row of rows){const r=validateGeographicAssertion(row.record);
  if(r.sensitivity!=='historical'||r.context==='modern-reference'&&!includeModernReference)continue;
  const properties={assertionId:r.id,revision:row.revision,subject:r.subject,claim:r.claim,evidence:r.evidence,validDuring:r.validDuring,uncertainty:r.uncertainty,names:r.names,context:r.context,reviewStatus:'separate-scoped-review-required'};
  if(r.geometry===null)unlocated.push(properties);else features.push({type:'Feature',id:r.id,geometry:r.geometry,properties});
 }
 return freeze({type:'FeatureCollection',features,unlocated,publiclyReleased:false,scope:'preauthorized-research-only',omittedCount:null});
});}
