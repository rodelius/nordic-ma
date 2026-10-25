export const MAX_FEEDBACK_WINDOW=500;
export function feedbackWindow(){const n=Number(process.env.SCORING_FEEDBACK_LIMIT||500);return Number.isInteger(n)&&n>=1&&n<=MAX_FEEDBACK_WINDOW?n:500;}
export function reviewHistoryLimit(){return Math.max(100,feedbackWindow());}
