/**
 * Send a LinkedIn reply via the Unipile API and log it as a CRM note.
 * Also supports scheduled (delayed) replies via a JSONL queue file.
 */
import https from "https";
import fs from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { updatePersonStage } from "./linkedin-connections.js";

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY || "";
const UNIPILE_DSN = process.env.UNIPILE_DSN || "";
const SCHEDULED_QUEUE_FILE = process.env.LINKEDIN_SCHEDULED_QUEUE || "/root/.nanobot/linkedin_scheduled_replies.jsonl";

interface ScheduledReply {
  chatId: string;
  linkedinUrl?: string; // fallback for new connections with no chat
  messageText: string;
  senderName: string;
  contactId: string | null;
  sendAt: string; // ISO timestamp
  slackChannelId: string;
  slackMessageTs: string;
  scheduledBy: string; // Slack user ID
}
const TOOL_SCRIPTS_PATH = process.env.TOOL_SCRIPTS_PATH || "/root/.nanobot/tools";
const CRM_TOOL = join(TOOL_SCRIPTS_PATH, "crm.sh");
const LINKEDIN_TOOL = join(TOOL_SCRIPTS_PATH, "linkedin.sh");

/**
 * Send a message to a LinkedIn chat via Unipile.
 */
export async function sendLinkedInReply(
  chatId: string,
  messageText: string
): Promise<{ success: boolean; error?: string }> {
  if (!UNIPILE_API_KEY || !UNIPILE_DSN) {
    return { success: false, error: "Unipile API not configured" };
  }

  try {
    const body = JSON.stringify({ text: messageText });

    const result = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        `https://${UNIPILE_DSN}/api/v1/chats/${chatId}/messages`,
        {
          method: "POST",
          headers: {
            "X-API-KEY": UNIPILE_API_KEY,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Unipile ${res.statusCode}: ${data}`));
            }
          });
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    console.log(`[linkedin-reply] Sent reply to chat ${chatId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[linkedin-reply] Send failed:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Send a new LinkedIn message to a person (no existing chat).
 * Uses the linkedin.sh send-message command which creates a chat via Unipile.
 * The recipientId should be an ACoAAA provider ID or a LinkedIn URL.
 */
export function sendNewLinkedInMessage(
  recipientId: string,
  messageText: string
): { success: boolean; error?: string } {
  try {
    const result = execFileSync("bash", [LINKEDIN_TOOL, "send-message", recipientId, messageText], {
      timeout: 30000,
      encoding: "utf-8",
    });
    console.log(`[linkedin-reply] Sent new message to ${recipientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[linkedin-reply] Send new message failed:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Log an outbound reply as a CRM note on the contact.
 */
export function logReplyNote(
  contactId: string,
  senderName: string,
  replyText: string
): void {
  try {
    const title = `LinkedIn Reply to ${senderName}`;
    const content = [
      replyText,
      "",
      "**Type:** LinkedIn Outbound Reply (via Slack)",
      `**To:** ${senderName}`,
      `**Date:** ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`,
    ].join("\n");

    execFileSync("bash", [CRM_TOOL, "write-note", title, content, "person", contactId], {
      timeout: 15000,
      encoding: "utf-8",
    });
  } catch (err) {
    console.error("[linkedin-reply] CRM note error:", err);
  }
}

/**
 * Schedule a LinkedIn reply for later delivery.
 */
export function scheduleLinkedInReply(reply: ScheduledReply): void {
  try {
    const line = JSON.stringify(reply) + "\n";
    fs.appendFileSync(SCHEDULED_QUEUE_FILE, line, "utf-8");
    console.log(`[linkedin-reply] Scheduled reply to ${reply.senderName} for ${reply.sendAt}`);
  } catch (err) {
    console.error("[linkedin-reply] Schedule error:", err);
  }
}

/**
 * Process all due scheduled replies. Called by cron every minute.
 * Returns the number of messages sent.
 */
export async function processScheduledReplies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slackClient?: any
): Promise<number> {
  if (!fs.existsSync(SCHEDULED_QUEUE_FILE)) return 0;

  const lines = fs.readFileSync(SCHEDULED_QUEUE_FILE, "utf-8").split("\n").filter(Boolean);
  if (lines.length === 0) return 0;

  const now = new Date();
  const remaining: string[] = [];
  let sent = 0;

  for (const line of lines) {
    try {
      const reply: ScheduledReply = JSON.parse(line);
      const sendAt = new Date(reply.sendAt);

      if (sendAt <= now) {
        // Time to send — use existing chat or create new message
        const result = reply.chatId
          ? await sendLinkedInReply(reply.chatId, reply.messageText)
          : reply.linkedinUrl
            ? sendNewLinkedInMessage(reply.linkedinUrl, reply.messageText)
            : { success: false, error: "No chat_id or linkedin_url" };

        if (result.success) {
          sent++;
          console.log(`[linkedin-reply] Sent scheduled reply to ${reply.senderName}`);

          // Log CRM note and update stage
          if (reply.contactId) {
            logReplyNote(reply.contactId, reply.senderName, reply.messageText);
            updatePersonStage(reply.contactId, "MESSAGED");
          }

          // Notify in Slack thread
          if (slackClient && reply.slackChannelId && reply.slackMessageTs) {
            try {
              await slackClient.chat.postMessage({
                channel: reply.slackChannelId,
                thread_ts: reply.slackMessageTs,
                text: `:clock1: Scheduled reply sent to ${reply.senderName}:\n>${reply.messageText.slice(0, 300)}`,
              });
            } catch {
              // non-critical
            }
          }
        } else {
          console.error(`[linkedin-reply] Scheduled send failed for ${reply.senderName}: ${result.error}`);
          // Keep in queue to retry next cycle
          remaining.push(line);
        }
      } else {
        // Not yet due
        remaining.push(line);
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Rewrite queue with remaining entries
  fs.writeFileSync(SCHEDULED_QUEUE_FILE, remaining.join("\n") + (remaining.length ? "\n" : ""), "utf-8");

  return sent;
}
