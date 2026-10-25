// Whole-graph extraction from caller-supplied feed excerpts is retired.
// Reviewer extraction uses stored source identity and retained full-text evidence.
export async function POST(){return Response.json({error:'Use /api/extraction with a stored sourceId for evidence-linked full-article extraction.'},{status:410,headers:{'Cache-Control':'private, no-store'}});}
