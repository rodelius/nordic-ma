export const DISMISS_REASONS={not_ma:'Not an M&A situation',non_nordic:'No Nordic connection',routine:'Routine disclosure',reporting:'Reporting',duplicate:'Duplicate',low_ficc:'Low FICC relevance',stale:'Stale / already covered',other:'Other / uncertain'} as const;
export type DismissReason=keyof typeof DISMISS_REASONS;
