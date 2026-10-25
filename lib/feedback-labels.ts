export const DISMISS_REASONS={not_event:'Not a qualifying corporate event',non_nordic:'No Nordic connection',routine:'Routine disclosure',reporting:'Reporting',duplicate:'Duplicate',low_ficc:'Low FICC relevance',stale:'Stale / already covered',other:'Other / uncertain'} as const;
export type DismissReason=keyof typeof DISMISS_REASONS;
