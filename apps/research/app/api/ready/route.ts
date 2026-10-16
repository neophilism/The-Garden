export const dynamic='force-dynamic';
export async function GET(){return Response.json({service:'research',status:'not_ready',dependencies:{identity:'not_configured',database:'not_connected',storage:'not_connected'},private_record_access:false},{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
