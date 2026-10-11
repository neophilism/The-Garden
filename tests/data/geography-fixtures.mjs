import {randomUUID} from 'node:crypto';
import {unknown} from './fixtures.mjs';
export const years=(a=1700,b=1750)=>({verbatim:'Synthetic source date range',earliestYear:a,latestYear:b,calendar:'source calendar not inferred'});
export const square=(x=0,y=0,s=2)=>[[x,y],[x+s,y],[x+s,y+s],[x,y+s],[x,y]];
export function geographic(){return {recordType:'geographic-assertion',schemaVersion:1,id:randomUUID(),subject:{id:randomUUID(),revision:'2',kind:'place'},claim:{id:randomUUID(),revision:'2'},evidence:[{id:randomUUID(),revision:'2'}],crs:'OGC:CRS84',geometry:{type:'Point',coordinates:[10,20]},validDuring:years(),uncertainty:{kind:'approximate',radiusMeters:2000,description:'Synthetic reported location with explicitly approximate extent.'},context:'historical-assertion',sensitivity:'historical',names:[{value:'Historical synthetic name',language:null,validDuring:unknown()}],rationale:'Synthetic source-bound assertion; not historical research.'};}
