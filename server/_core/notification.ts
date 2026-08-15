import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  const title = input.title?.trim();
  const content = input.content?.trim();
  if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is required." });
  if (!content) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is required." });
  if (title.length > TITLE_MAX_LENGTH) throw new TRPCError({ code: "BAD_REQUEST", message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.` });
  if (content.length > CONTENT_MAX_LENGTH) throw new TRPCError({ code: "BAD_REQUEST", message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.` });
  return { title, content };
};

/**
 * Sends a notification to a generic webhook when configured. Without a
 * webhook, the event is logged and the application continues to operate.
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const validated = validatePayload(payload);
  if (!ENV.notificationWebhookUrl) {
    console.info("[Notification]", validated.title, validated.content);
    return false;
  }

  try {
    const response = await fetch(ENV.notificationWebhookUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(ENV.notificationWebhookToken
          ? { authorization: `Bearer ${ENV.notificationWebhookToken}` }
          : {}),
      },
      body: JSON.stringify(validated),
    });
    if (!response.ok) {
      console.warn(`[Notification] Webhook returned ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Webhook request failed", error);
    return false;
  }
}
