/** Synthetic SQL observation adapter; never used by application runtime. */
export function roleProbe(login,overrides={}){
 let current=login,checks=0;
 return (sql,args)=>{
  if(sql.startsWith('SET LOCAL ROLE '))current=sql.slice('SET LOCAL ROLE '.length);
  if(sql==='COMMIT'||sql==='ROLLBACK')current=login;
  if(!sql.startsWith('SELECT current_user'))return null;
  checks++;
  return {rows:[{login_role:login,current_role:current,login_enabled:true,elevated:false,
   expected:true,can_set:true,inherited:false,conflicting:false,unsafe_capability:false,owns_objects:false,
   ...(typeof overrides==='function'?overrides({checks,capability:args?.[0]}):overrides)}]};
 };
}
