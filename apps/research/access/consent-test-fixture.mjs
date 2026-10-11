/** Explicit non-personal consent basis for synthetic CI fixtures ONLY.
 * This is not a source import, a rights decision, or a production bypass. */
export async function allowSyntheticResearchUse(admin,workspace,recordId){
 if(process.env.CI!=='true'||process.env.GARDEN_IDENTITY_TEST!=='ephemeral-ci'||process.env.GARDEN_DB_TARGET!=='ci'||process.env.PGHOST!=='127.0.0.1'||process.env.PGUSER!=='postgres')throw new Error('Synthetic consent fixture requires isolated CI');
 const policy={schemaVersion:1,recordId,basis:'no-consent-required',inputs:[],terms:null,subjects:[],purposes:['research'],reasonDigest:'1'.repeat(64)};
 await admin.query("SELECT garden_control.set_use_policy($1::uuid,$2::jsonb,0,'synthetic-fixture')",[workspace,JSON.stringify(policy)]);
}
