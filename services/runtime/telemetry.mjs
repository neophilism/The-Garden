import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const events=new Set(['request_completed','service_started','service_stopped','dependency_failed']);
const routes=new Set(['public_page','public_asset','liveness','readiness','not_found','method_denied']);
/** Closed field set: never accept headers, URLs, bodies, subjects or error objects. */
export function operationalEvent(input){
 if(!input||!events.has(input.event))throw new Error('Invalid operational event');
 const result={event:input.event};
 if(['public','research'].includes(input.service))result.service=input.service;
 if(typeof input.requestId==='string'&&/^[a-f0-9-]{36}$/.test(input.requestId))result.request_id=input.requestId;
 if(routes.has(input.route))result.route=input.route;
 if(Number.isInteger(input.status)&&input.status>=100&&input.status<=599)result.status=input.status;
 if(Number.isFinite(input.durationMs)&&input.durationMs>=0)result.duration_ms=Math.min(Math.round(input.durationMs),3600000);
 if(['database','identity','storage'].includes(input.dependency))result.dependency=input.dependency;
 return Object.freeze(result);
}
// No request telemetry exporter is enabled by default. An explicitly supplied
// operational sink owns its access/retention policy; tests use an in-memory sink.
export function requestObservation(service,write=()=>{}){
 const requestId=randomUUID(),start=performance.now();let completed=false;
 return Object.freeze({requestId,complete(route,status){
  if(completed)return;completed=true;
  write(operationalEvent({event:'request_completed',service,requestId,route,status,durationMs:performance.now()-start}));
 }});
}
