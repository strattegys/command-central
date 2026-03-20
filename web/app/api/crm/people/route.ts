import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    const rows = await query(
      `SELECT
        p.id,
        p."nameFirstName" AS "firstName",
        p."nameLastName" AS "lastName",
        p."jobTitle" AS "jobTitle",
        p."emailsPrimaryEmail" AS email,
        p."linkedinLinkPrimaryLinkUrl" AS "linkedinUrl",
        COALESCE(p.stage::text, 'TARGET') AS stage,
        p.city,
        COALESCE(c.name, '') AS "companyName"
      FROM person p
      LEFT JOIN company c ON c.id = p."companyId" AND c."deletedAt" IS NULL
      WHERE p."activeCampaignId" = $1
        AND p."deletedAt" IS NULL
      ORDER BY p."nameFirstName" ASC NULLS LAST`,
      [campaignId]
    );

    const people = rows.map((r) => ({
      id: r.id,
      firstName: r.firstName || "",
      lastName: r.lastName || "",
      jobTitle: r.jobTitle || "",
      email: r.email || "",
      linkedinUrl: r.linkedinUrl || "",
      stage: r.stage || "TARGET",
      city: r.city || "",
      companyName: r.companyName || "",
    }));

    return NextResponse.json({ people });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch people";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
