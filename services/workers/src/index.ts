/** Placeholder interfaces only. Does not read or migrate historical records. */
export type ImportJobState="not_authorized"|"queued"|"quarantined"|"reviewed"|"failed";
export function canPublish(status:ImportJobState):boolean{return status==="reviewed"&&false;}
