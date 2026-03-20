import { NextResponse, type NextRequest } from "next/server";
import { crmFetch } from "@/lib/crm";

interface RawPerson {
  id: string;
  name?: { firstName?: string; lastName?: string };
  emails?: { primaryEmail?: string };
  linkedinLink?: { primaryLinkUrl?: string };
  company?: { name?: string };
  jobTitle?: string;
  stage?: string;
  city?: string;
}

function mapPerson(p: RawPerson) {
  return {
    id: p.id,
    firstName: p.name?.firstName ?? "",
    lastName: p.name?.lastName ?? "",
    jobTitle: p.jobTitle ?? "",
    email: p.emails?.primaryEmail ?? "",
    linkedinUrl: p.linkedinLink?.primaryLinkUrl ?? "",
    stage: p.stage || "TARGET",
    city: p.city ?? "",
    companyName: p.company?.name ?? "",
  };
}

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    const allPeople: ReturnType<typeof mapPerson>[] = [];
    let cursor: string | null = null;
    const PAGE_SIZE = 200;

    // Paginate through all results
    for (let page = 0; page < 20; page++) {
      let path =
        `/rest/people?filter[activeCampaignId][eq]=${campaignId}&limit=${PAGE_SIZE}` +
        `&orderBy=name.firstName=AscNullsLast`;
      if (cursor) {
        path += `&startingAfter=${cursor}`;
      }

      const data = await crmFetch(path);
      const raw: RawPerson[] = data.data?.people ?? data.people ?? data.data ?? [];

      for (const p of raw) {
        allPeople.push(mapPerson(p));
      }

      // If we got fewer than PAGE_SIZE, we're done
      if (raw.length < PAGE_SIZE) break;

      // Use last item's id as cursor for next page
      cursor = raw[raw.length - 1].id;
    }

    return NextResponse.json({ people: allPeople });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch people";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
