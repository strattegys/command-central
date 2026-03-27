/**
 * Warm outreach — shared sentinel for discovery placeholder rows on `person.jobTitle`.
 * (Same string as `insertWarmOutreachDiscoveryItem` / package activate.)
 */

export const WARM_OUTREACH_PLACEHOLDER_JOB_TITLE = "Warm outreach — awaiting contact details";

export function isWarmOutreachPlaceholderJobTitle(value: string | null | undefined): boolean {
  if (value == null || !String(value).trim()) return false;
  return String(value).trim().toLowerCase() === WARM_OUTREACH_PLACEHOLDER_JOB_TITLE.toLowerCase();
}
