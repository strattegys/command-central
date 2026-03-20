/**
 * Handles inbound LinkedIn messages and connection events from Unipile webhooks.
 * Ported from slack/src/linkedin-inbound.ts — replaces Slack alerts with
 * web notifications and Tim autonomous chat messages.
 */
import { execFileSync } from "child_process";
import { join } from "path";
import {
  findOrCreateContact,
  writeNote,
  updatePersonStage,
  getPersonStage,
  fetchLinkedInProfile,
  enrichContactFromLinkedIn,
} from "./linkedin-crm";
import { triageLinkedInMessage } from "./linkedin-triage";
import { writeNotification } from "./notifications";

const TOOL_SCRIPTS_PATH = process.env.TOOL_SCRIPTS_PATH || "/root/.nanobot/tools";
const LINKEDIN_TOOL = join(TOOL_SCRIPTS_PATH, "linkedin.sh");

// Govind's LinkedIn provider ID — used to identify outbound messages
const SELF_PROVIDER_ID =
  process.env.LINKEDIN_SELF_PROVIDER_ID || "ACoAAAFQFlkB-uguiq0-0980Ud_J2pdFMjzpQl8";

interface UnipileWebhookPayload {
  account_id: string;
  account_type: string;
  account_info?: { user_id?: string };
  event: string;
  chat_id: string;
  message_id: string;
  message: string;
  sender?: {
    attendee_id?: string;
    attendee_name?: string;
    attendee_provider_id?: string;
  };
  timestamp: string;
  // new_relation event fields
  relation_name?: string;
  name?: string;
  user_name?: string;
  relation_provider_id?: string;
  provider_id?: string;
  user_provider_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Main webhook handler — called from the API route.
 */
export async function handleUnipileWebhook(
  payload: UnipileWebhookPayload
): Promise<void> {
  const event = payload.event;

  if (event === "new_relation") {
    console.log("[linkedin-webhook] new_relation event");
    await handleNewRelation(payload);
    return;
  }

  if (event !== "message_received") {
    console.log(`[linkedin-webhook] Ignoring event: ${event}`);
    return;
  }

  const senderName = payload.sender?.attendee_name || "Unknown";
  const senderProviderId = payload.sender?.attendee_provider_id || "";
  const messageText = payload.message || "";
  const chatId = payload.chat_id || "";
  const timestamp = payload.timestamp || new Date().toISOString();

  // Determine direction: outbound if sender is self
  const isOutbound =
    senderProviderId === SELF_PROVIDER_ID ||
    senderProviderId === payload.account_info?.user_id;

  if (isOutbound) {
    console.log(`[linkedin-webhook] Outbound message in chat ${chatId} — logging silently`);
    return;
  }

  console.log(`[linkedin-webhook] Inbound message from ${senderName} (${senderProviderId})`);

  // Find or create CRM contact
  const contactId = findOrCreateContact(senderName, senderProviderId);
  if (!contactId) {
    console.error(`[linkedin-webhook] Could not find/create contact for ${senderName}`);
    return;
  }

  // If person was MESSAGED and they're replying → ENGAGED
  const currentStage = getPersonStage(contactId);
  if (currentStage === "MESSAGED") {
    updatePersonStage(contactId, "ENGAGED");
  }

  // Log as CRM note
  const formattedTime = formatTime(timestamp);
  const linkedinUrl = senderProviderId
    ? `https://www.linkedin.com/in/${senderProviderId}`
    : "";

  const noteTitle = `LinkedIn Message from ${senderName}`;
  const noteContent = [
    messageText,
    "",
    "**Type:** LinkedIn Inbound Message",
    `**From:** ${senderName}`,
    `**Date:** ${formattedTime}`,
    `**Chat ID:** ${chatId}`,
    linkedinUrl ? `**LinkedIn Profile:** ${linkedinUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  writeNote(noteTitle, noteContent, "person", contactId);

  // Triage via Tim's AI
  console.log(`[linkedin-webhook] Running triage for ${senderName}...`);
  const triage = await triageLinkedInMessage(
    senderName,
    messageText,
    contactId,
    linkedinUrl
  );

  // Deliver notification — workflow members just get CRM note (Kanban shows it),
  // non-workflow members get Tim messaging Govind
  const hasWorkflow = triage.workflowInfo && triage.workflowInfo !== "None";

  // Always write web notification
  writeNotification(
    `LinkedIn: ${senderName}`,
    [
      messageText.slice(0, 150),
      triage.personSummary ? `(${triage.personSummary})` : "",
    ]
      .filter(Boolean)
      .join(" "),
    "linkedin_inbound"
  );

  if (!hasWorkflow) {
    // Non-workflow: Tim proactively messages Govind
    try {
      const { autonomousChat } = await import("./gemini");
      const prompt = [
        `[LINKEDIN INBOUND — Notify Govind]`,
        ``,
        `You just received a LinkedIn message from ${senderName}.`,
        ``,
        `**Message:** "${messageText.slice(0, 500)}"`,
        triage.personSummary ? `**Who they are:** ${triage.personSummary}` : "",
        triage.suggestedReply ? `**Suggested reply:** ${triage.suggestedReply}` : "",
        ``,
        `Tell Govind about this message in a concise, helpful way. Include who they are and what they said. If you have a suggested reply, present it for approval.`,
        `Do NOT send any messages without explicit approval.`,
      ]
        .filter(Boolean)
        .join("\n");

      await autonomousChat("tim", prompt);
    } catch (err) {
      console.error("[linkedin-webhook] Tim autonomous notification failed:", err);
    }
  }

  console.log(`[linkedin-webhook] Processed inbound from ${senderName} → contact ${contactId}`);
}

/**
 * Handle invitation acceptance (new_relation event).
 */
async function handleNewRelation(payload: UnipileWebhookPayload): Promise<void> {
  const senderName =
    payload.sender?.attendee_name ||
    payload.relation_name ||
    payload.name ||
    payload.user_name ||
    "Unknown";
  const senderProviderId =
    payload.sender?.attendee_provider_id ||
    payload.relation_provider_id ||
    payload.provider_id ||
    payload.user_provider_id ||
    "";
  const timestamp = payload.timestamp || new Date().toISOString();

  console.log(`[linkedin-webhook] Invitation accepted by ${senderName} (${senderProviderId})`);

  // Find or create CRM contact
  const contactId =
    senderName !== "Unknown" || senderProviderId
      ? findOrCreateContact(senderName, senderProviderId)
      : null;

  const linkedinUrl = senderProviderId
    ? `https://www.linkedin.com/in/${senderProviderId}`
    : "";

  // Enrich contact and set stage to ACCEPTED
  if (contactId && senderProviderId) {
    const profile = fetchLinkedInProfile(senderProviderId);
    if (profile) {
      enrichContactFromLinkedIn(contactId, profile);
    }
    updatePersonStage(contactId, "ACCEPTED");
  }

  // Log CRM note
  if (contactId) {
    writeNote(
      `LinkedIn Connection Accepted — ${senderName}`,
      [
        `${senderName} accepted your LinkedIn connection invitation.`,
        "",
        "**Type:** LinkedIn Invitation Accepted",
        `**Date:** ${formatTime(timestamp)}`,
        linkedinUrl ? `**LinkedIn Profile:** ${linkedinUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      "person",
      contactId
    );
  }

  // Web notification
  writeNotification(
    `Connection Accepted: ${senderName}`,
    `${senderName} accepted your LinkedIn invitation`,
    "linkedin_inbound"
  );

  console.log(`[linkedin-webhook] Processed invitation acceptance from ${senderName}`);
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return (
      d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT"
    );
  } catch {
    return isoString;
  }
}
