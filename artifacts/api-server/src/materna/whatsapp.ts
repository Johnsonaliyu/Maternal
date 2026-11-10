import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { rm } from "node:fs/promises";
import path from "node:path";
import { logger } from "../lib/logger";
import { handleIncomingMessage, startConversation } from "./conversationFlow";
import {
  formatNigeriaDateTime,
  reminderCategoryLabel,
} from "./reminders";
import { getSession, listSessions, saveSession } from "./sessionStore";

export type WhatsAppConnectionStatus =
  | "not_started"
  | "connecting"
  | "qr_ready"
  | "connected"
  | "closed"
  | "error";

let status: WhatsAppConnectionStatus = "not_started";
let socket: WASocket | undefined;
let reconnecting = false;
let latestQr: string | null = null;
let reminderTimer: NodeJS.Timeout | undefined;
let deliveringReminders = false;

function extractText(message: any): string | undefined {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption
  );
}

export function getWhatsAppStatus() {
  return {
    status,
    connected: status === "connected",
    qr: latestQr,
  };
}

async function connect() {
  status = "connecting";
  const authDir = path.resolve(process.env.MATERNA_AUTH_DIR ?? "data/materna-auth");
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const connectionSocket = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Afeeyah AI", "Chrome", "1.0.0"],
    logger,
  });
  socket = connectionSocket;

  connectionSocket.ev.on("creds.update", saveCreds);
  connectionSocket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (socket !== connectionSocket) return;

    if (qr) {
      status = "qr_ready";
      latestQr = qr;
      logger.info("Afeeyah AI WhatsApp QR ready; scan it with the WhatsApp number");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      status = "connected";
      latestQr = null;
      logger.info("Afeeyah AI WhatsApp connection opened");
    } else if (connection === "close") {
      status = "closed";
      latestQr = null;
      socket = undefined;
      const disconnectCode = (
        lastDisconnect?.error as
          | { output?: { statusCode?: number } }
          | undefined
      )?.output?.statusCode;
      const loggedOut = disconnectCode === DisconnectReason.loggedOut;
      // 440 = this WhatsApp login was opened somewhere else (e.g. another deployment
      // using the same paired number). Reconnecting just starts a tug-of-war.
      const replaced = disconnectCode === DisconnectReason.connectionReplaced;
      const shouldReconnect = !replaced;
      logger.warn(
        { shouldReconnect, loggedOut, replaced, disconnectCode },
        "Afeeyah AI WhatsApp connection closed",
      );
      if (shouldReconnect && !reconnecting) {
        reconnecting = true;
        setTimeout(() => {
          void (async () => {
            try {
              if (loggedOut) {
                await rm(authDir, { recursive: true, force: true });
                logger.info("Afeeyah AI WhatsApp auth cleared after logout; requesting a new QR");
              }
              await connect();
            } catch (error: unknown) {
              status = "error";
              logger.error({ err: error }, "Afeeyah AI WhatsApp reconnect failed");
            } finally {
              reconnecting = false;
            }
          })();
        }, loggedOut ? 500 : 3000);
      }
    }
  });

  connectionSocket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (socket !== connectionSocket) return;

    if (type !== "notify") return;
    for (const message of messages) {
      if (message.key.fromMe || !message.key.remoteJid) continue;
      const text = extractText(message.message);
      if (!text) continue;
      const phoneNumber = message.key.remoteJid;
      const sendPresence = async (presence: "composing" | "paused") => {
        try {
          await socket?.presenceSubscribe(phoneNumber);
          await socket?.sendPresenceUpdate(presence, phoneNumber);
        } catch (error) {
          logger.debug({ err: error, phoneNumber, presence }, "Afeeyah AI presence update failed");
        }
      };
      try {
        await sendPresence("composing");
        const existingSession = await getSession(phoneNumber);
        const sendReply = async (reply: string) => {
          await socket?.sendMessage(phoneNumber, { text: reply });
        };
        if (!existingSession || existingSession.chatHistory.length === 0) {
          await startConversation(phoneNumber, sendReply);
          continue;
        }
        await handleIncomingMessage({
          phoneNumber,
          text,
          sendMessage: sendReply,
        });
      } catch (error) {
        logger.error({ err: error, phoneNumber }, "Afeeyah AI message handling failed");
        // Must not throw: an error here escapes the event handler and, on Node 24,
        // an unhandled rejection kills the whole process.
        await socket
          ?.sendMessage(phoneNumber, {
            text: "Something went wrong while processing that message. Please try again.",
          })
          .catch((sendError: unknown) => {
            logger.warn({ err: sendError, phoneNumber }, "Afeeyah AI error reply failed");
          });
      } finally {
        await sendPresence("paused");
      }
    }
  });
}

export async function resetWhatsAppPairing() {
  if (reconnecting) {
    throw new Error("WhatsApp pairing is already being reset.");
  }

  const authDir = path.resolve(process.env.MATERNA_AUTH_DIR ?? "data/materna-auth");
  const currentSocket = socket;
  reconnecting = true;
  status = "closed";
  latestQr = null;
  socket = undefined;

  try {
    await currentSocket?.logout().catch((error: unknown) => {
      logger.debug({ err: error }, "WhatsApp logout was already completed");
    });
    await rm(authDir, { recursive: true, force: true });
    logger.info("Afeeyah AI WhatsApp pairing reset; requesting a new QR");
    await connect();
  } finally {
    reconnecting = false;
  }
}

async function deliverDueReminders() {
  if (!socket || status !== "connected" || deliveringReminders) return;
  deliveringReminders = true;

  try {
    const now = Date.now();
    const sessions = await listSessions();
    for (const session of sessions) {
      const dueReminders = (session.reminders ?? []).filter(
        (reminder) => !reminder.sentAt && new Date(reminder.remindAt).getTime() <= now,
      );

      for (const reminder of dueReminders) {
        try {
          const reminderMessage =
            `Reminder: ${reminder.text}\n\n` +
            `This is your ${reminderCategoryLabel(reminder.category)} reminder, ` +
            `scheduled for ${formatNigeriaDateTime(reminder.remindAt)} (Nigeria time, UTC+1).`;
          await socket.sendMessage(session.phoneNumber, { text: reminderMessage });
          reminder.sentAt = new Date().toISOString();
          session.chatHistory.push({
            role: "assistant",
            text: reminderMessage,
            createdAt: reminder.sentAt,
          });
          if (session.chatHistory.length > 50) session.chatHistory.shift();
          await saveSession(session);
          logger.info(
            { phoneNumber: session.phoneNumber, reminderId: reminder.id },
            "Afeeyah AI reminder delivered",
          );
        } catch (error) {
          logger.error(
            { err: error, phoneNumber: session.phoneNumber, reminderId: reminder.id },
            "Afeeyah AI reminder delivery failed",
          );
        }
      }
    }
  } finally {
    deliveringReminders = false;
  }
}

function startReminderScheduler() {
  if (reminderTimer) return;
  reminderTimer = setInterval(() => {
    void deliverDueReminders();
  }, 30_000);
  void deliverDueReminders();
}

export async function startWhatsApp() {
  if (status === "connecting" || status === "connected" || status === "qr_ready") return;
  startReminderScheduler();
  await connect();
}

export async function previewConversation(phoneNumber: string, text: string) {
  const messages: string[] = [];
  await handleIncomingMessage({
    phoneNumber,
    text,
    sendMessage: async (message) => {
      messages.push(message);
    },
  });
  return messages;
}

export async function previewConversationStart(phoneNumber: string) {
  const messages: string[] = [];
  await startConversation(phoneNumber, async (message) => {
    messages.push(message);
  });
  return messages;
    }
