/**
 * LinkedIn message triage via Tim's AI.
 * Before posting to Slack, Tim analyzes the sender (CRM person summary,
 * campaign context) and suggests a reply.
 */
import { chat } from "../../web/lib/gemini";
import { dirname } from "path";
import { getAgentConfig } from "../../web/lib/agent-config";

export interface TriageResult {
  personSummary: string;
  campaignInfo: string;
  suggestedReply: string;
}

const TRIAGE_TIMEOUT_MS = 60_000; // 60s max for triage

/**
 * Dedicated session file for triage — separate from Tim's main Slack session.
 * Each triage call is effectively stateless (session accumulates but doesn't
 * pollute Tim's main conversation).
 */
function getTriageSessionFile(): string {
  const config = getAgentConfig("tim");
  const sessionDir = dirname(config.sessionFile);
  return `${sessionDir}/linkedin_triage.jsonl`;
}

/**
 * Ask Tim to triage an inbound LinkedIn message.
 * Returns structured person summary, campaign info, and suggested reply.
 * On failure/timeout, returns a fallback with empty fields.
 */
export async function triageLinkedInMessage(
  senderName: string,
  messageText: string,
  contactId: string,
  linkedinUrl: string
): Promise<TriageResult> {
  const fallback: TriageResult = {
    personSummary: "",
    campaignInfo: "",
    suggestedReply: "",
  };

  const prompt = [
    `You just received a LinkedIn message. Triage it by looking up the sender in the CRM and providing context.`,
    ``,
    `**Sender:** ${senderName}`,
    `**CRM Contact ID:** ${contactId}`,
    linkedinUrl ? `**LinkedIn:** ${linkedinUrl}` : "",
    ``,
    `**Message:**`,
    `> ${messageText.slice(0, 1000)}`,
    ``,
    `Instructions:`,
    `1. Look up this person in the CRM using their contact ID (use get-person ${contactId})`,
    `2. Check if they have an active campaign (use get-campaign-context ${contactId})`,
    `3. Respond in EXACTLY this format with no extra text:`,
    ``,
    `PERSON_SUMMARY: <1-2 sentence summary of who they are — role, company, key context>`,
    `CAMPAIGN_INFO: <campaign name and stage if any, otherwise "None">`,
    `SUGGESTED_REPLY: <a short, natural reply to their message based on context>`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  try {
    const response = await Promise.race([
      chat("tim", prompt, { sessionFile: getTriageSessionFile() }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Triage timeout")), TRIAGE_TIMEOUT_MS)
      ),
    ]);

    return parseTriageResponse(response);
  } catch (err) {
    console.error("[linkedin-triage] Triage failed, using fallback:", err);
    return fallback;
  }
}

/**
 * Ask Tim to triage a new LinkedIn connection (no message yet).
 * Suggests an opening message based on the person's profile.
 */
export async function triageNewConnection(
  name: string,
  headline: string,
  contactId: string | null,
  linkedinUrl: string
): Promise<TriageResult> {
  const fallback: TriageResult = {
    personSummary: headline ? `${name} — ${headline}` : name,
    campaignInfo: "",
    suggestedReply: "",
  };

  const promptLines = [
    `A new LinkedIn connection was just established with this person. There is no message yet — suggest an opening message.`,
    ``,
    `**Name:** ${name}`,
    headline ? `**Headline:** ${headline}` : "",
    contactId ? `**CRM Contact ID:** ${contactId}` : "",
    linkedinUrl ? `**LinkedIn:** ${linkedinUrl}` : "",
    ``,
    `Instructions:`,
  ];

  if (contactId) {
    promptLines.push(
      `1. Look up this person in the CRM using their contact ID (use get-person ${contactId})`,
      `2. Check if they have an active campaign (use get-campaign-context ${contactId})`,
      `3. Based on their profile, role, and any campaign context, suggest a warm opening message.`,
    );
  } else {
    promptLines.push(
      `1. Based on their name and headline, summarize who they are.`,
      `2. Suggest a warm, personalized opening message to start a conversation.`,
    );
  }

  promptLines.push(
    ``,
    `Respond in EXACTLY this format with no extra text:`,
    ``,
    `PERSON_SUMMARY: <1-2 sentence summary of who they are — role, company, key context>`,
    `CAMPAIGN_INFO: <campaign name and stage if any, otherwise "None">`,
    `SUGGESTED_REPLY: <a short, warm opening message to initiate conversation>`,
  );

  const prompt = promptLines.filter((line) => line !== undefined).join("\n");

  try {
    const response = await Promise.race([
      chat("tim", prompt, { sessionFile: getTriageSessionFile() }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Triage timeout")), TRIAGE_TIMEOUT_MS)
      ),
    ]);

    return parseTriageResponse(response);
  } catch (err) {
    console.error("[linkedin-triage] New connection triage failed, using fallback:", err);
    return fallback;
  }
}

/**
 * Ask Tim to review a LinkedIn reply draft for typos, grammar, and tone.
 * Returns the corrected text (or the original if no changes needed).
 */
export async function checkLinkedInReply(
  senderName: string,
  draftText: string
): Promise<{ correctedText: string; changes: string }> {
  const prompt = [
    `Review this LinkedIn message draft for any typos, grammar issues, or awkward phrasing. Make minimal corrections — do not rewrite or change the tone.`,
    ``,
    `**Recipient:** ${senderName}`,
    `**Draft:**`,
    `${draftText}`,
    ``,
    `Respond in EXACTLY this format:`,
    `CORRECTED_TEXT: <the corrected message, or the exact original if no changes needed>`,
    `CHANGES: <brief description of what was fixed, or "No changes needed">`,
  ].join("\n");

  try {
    const response = await Promise.race([
      chat("tim", prompt, { sessionFile: getTriageSessionFile() }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Check timeout")), 30_000)
      ),
    ]);

    const correctedMatch = response.match(/CORRECTED_TEXT:\s*(.+?)(?=\nCHANGES:|$)/s);
    const changesMatch = response.match(/CHANGES:\s*(.+?)$/s);

    return {
      correctedText: correctedMatch?.[1]?.trim() || draftText,
      changes: changesMatch?.[1]?.trim() || "No changes needed",
    };
  } catch (err) {
    console.error("[linkedin-triage] Check failed, returning original:", err);
    return { correctedText: draftText, changes: "Check failed — using original text" };
  }
}

/**
 * Parse Tim's structured response into a TriageResult.
 */
function parseTriageResponse(response: string): TriageResult {
  const extract = (label: string): string => {
    const regex = new RegExp(`${label}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "s");
    const match = response.match(regex);
    return match?.[1]?.trim() || "";
  };

  return {
    personSummary: extract("PERSON_SUMMARY"),
    campaignInfo: extract("CAMPAIGN_INFO"),
    suggestedReply: extract("SUGGESTED_REPLY"),
  };
}
