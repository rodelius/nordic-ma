export const dynamic='force-dynamic';
export async function GET(){return Response.json({error:'Legacy deal schema retired. Use /api/corporate-events.'},{status:410});}
export const POST=GET;
