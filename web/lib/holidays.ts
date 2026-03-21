import { query } from "./db";

interface NagerHoliday {
  date: string; // "2026-01-01"
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  types: string[];
}

/**
 * Fetch US public holidays from Nager.Date API and upsert into _reminder table.
 * Runs monthly via cron to keep upcoming holidays populated.
 */
export async function syncHolidays(year?: number): Promise<number> {
  const targetYear = year ?? new Date().getFullYear();
  console.log(`[holidays] Syncing US holidays for ${targetYear}...`);

  let holidays: NagerHoliday[];
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${targetYear}/US`
    );
    if (!res.ok) {
      throw new Error(`Nager API returned ${res.status}`);
    }
    holidays = await res.json();
  } catch (err) {
    console.error(`[holidays] Failed to fetch holidays:`, err);
    return 0;
  }

  let upserted = 0;

  for (const h of holidays) {
    const d = new Date(h.date + "T00:00:00-08:00"); // Pacific time
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const anchor = JSON.stringify({ month, day });

    // Check if this holiday already exists for this year (by title + year match)
    const existing = await query<Record<string, unknown>>(
      `SELECT id FROM "_reminder"
       WHERE "agentId" = 'suzi'
         AND category = 'holiday'
         AND title = $1
         AND "deletedAt" IS NULL
         AND EXTRACT(YEAR FROM "nextDueAt") = $2
       LIMIT 1`,
      [h.localName, targetYear]
    );

    if (existing.length > 0) {
      // Already exists, skip
      continue;
    }

    // Insert new holiday reminder
    await query(
      `INSERT INTO "_reminder" ("agentId", category, title, description, "nextDueAt", recurrence, "recurrenceAnchor", "advanceNoticeDays")
       VALUES ('suzi', 'holiday', $1, $2, $3, 'yearly', $4, 1)`,
      [
        h.localName,
        h.name !== h.localName ? h.name : null,
        d.toISOString(),
        anchor,
      ]
    );
    upserted++;
  }

  console.log(
    `[holidays] Synced ${upserted} new holidays for ${targetYear} (${holidays.length} total from API)`
  );
  return upserted;
}

/**
 * Sync holidays for current year and next year.
 * Called by monthly cron job.
 */
export async function syncUpcomingHolidays(): Promise<void> {
  const now = new Date();
  await syncHolidays(now.getFullYear());
  await syncHolidays(now.getFullYear() + 1);
}
