import { liveness } from '../../../../../services/runtime/release.mjs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(liveness('research'),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
