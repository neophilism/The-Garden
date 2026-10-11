import {readFileSync} from 'node:fs';
import {resolveConfiguration,ConfigurationError} from './environment.ts';
/** Called by Next.js config at build/start, never exported to a client bundle. */
export function assertProcessConfiguration(surface,env=process.env){
 try{
  const registry=JSON.parse(readFileSync(new URL('./resource-registry.json',import.meta.url),'utf8'));
  return resolveConfiguration(env,registry,surface);
 }catch(error){
  if(error instanceof ConfigurationError)throw error;
  throw new ConfigurationError('registry_unreadable');
 }
}
