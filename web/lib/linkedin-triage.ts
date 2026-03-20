/**
 * LinkedIn message triage via Tim's AI.
 * Tim analyzes the sender (CRM person summary, workflow context) and suggests a reply.
 */
import { chat } from "./gemini";
import { dirname } from "path";
import { getAgentConfig } from "./agent-config";

export interface TriageResult {
  personSummary: string;
  workflowInfo: string;
  suggestedReply: string;
}

const TRIAGE_TIMEOUT_MS = 60_000;

function getTriageSessionFile(): string {
  const config = getAgentConfig("tim");
  const sessionDir = dirname(config.sessionFile);
  return `${sessionDir}/linkedin_triage.jsonl`;
}

/**
 * Ask Tim to triage an inbound LinkedIn message.
 */
export async function triageLinkedInMessage(
  senderName: string,
  messageText: string,
  contactId: string,
  linkedinUrl: string
): Promise<TriageResult> {
  const fallback: TriageResult = {
    personSummary: "",
    workflowInfo: "",
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
    `2. Check if they have an active workflow (use get-workflow-context ${contactId})`,
    `3. Respond in EXACTLY this format with no extra text:`,
    ``,
    `PERSON_SUMMARY: <1-2 sentence summary of who they are — role, company, key context>`,
    `CAMPAIGN_INFO: <workflow name and stage if any, otherwise "None">`,
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
 */
export async function triageNewConnection(
  name: string,
  headline: string,
  contactId: string | null,
  linkedinUrl: string
): Promise<TriageResult> {
  const fallback: TriageResult = {
    personSummary: headline ? `${name} — ${headline}` : name,
    workflowInfo: "",
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
      `2. Check if they have an active workflow (use get-workflow-context ${contactId})`,
      `3. Based on their profile, role, and any workflow context, suggest a warm opening message.`,
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
    `CAMPAIGN_INFO: <workflow name and stage if any, otherwise "None">`,
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

function parseTriageResponse(response: string): TriageResult {
  const extract = (label: string): string => {
    const regex = new RegExp(`${label}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "s");
    const match = response.match(regex);
    return match?.[1]?.trim() || "";
  };

  return {
    personSummary: extract("PERSON_SUMMARY"),
    workflowInfo: extract("CAMPAIGN_INFO"),
    suggestedReply: extract("SUGGESTED_REPLY"),
  };
}
