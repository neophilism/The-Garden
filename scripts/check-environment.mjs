import {assertProcessConfiguration} from '../config/validate-process.mjs';
import {ConfigurationError} from '../config/environment.ts';
try{
 const surface=process.argv[2];
 if(!['public','research'].includes(surface)||process.argv.length!==3)throw new ConfigurationError('invalid_cli_usage');
 const safe=assertProcessConfiguration(surface);
 console.log(JSON.stringify({environment:safe.environment,surface:safe.surface,research_enabled:safe.research_enabled}));
}catch(error){
 // Never print configuration values or a raw parser exception.
 console.error(error instanceof ConfigurationError?error.message:'Garden configuration could not be validated');
 process.exitCode=1;
}
