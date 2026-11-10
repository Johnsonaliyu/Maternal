import { randomUUID } from "node:crypto";
import { answerHealthQuestion } from "./aiHandler";
import { logger } from "../lib/logger";
import { availableSlots, initializePaystackPayment } from "./payment";
import {
  NIGERIA_UTC_OFFSET,
  classifyReminder,
  formatNigeriaDateTime,
  parseNigeriaDateTime,
  reminderCategoryLabel,
} from "./reminders";
import { getOrCreateSession, saveSession } from "./sessionStore";
import type { MaternaStatus, UserSession } from "./types";

const consentNotice = `Before we continue, Afeeyah AI needs your consent to store:
• Your name
• Your WhatsApp number
• Chat history
• Medical history you choose to share
• Location, if you choose to share it
• Your preferred language

We use this to personalize support and improve continuity of care. Please reply YES to consent or NO to stop. You can change your mind by sending STOP.`;

const menu = `What would you like help with?
1. Ask a health question
2. Book a doctor
3. Set a health reminder

You can ask about common health concerns, pregnancy, maternal wellbeing, child health, immunisation, or preventive care.`;

const statusOptions = `Which best describes you?
1. Pregnant
2. Nursing
3. Planning a pregnancy`;

const normalize = (text: string) => text.trim().toLowerCase();

function isYes(text: string) {
  return ["yes", "y", "i agree", "agree", "consent", "1"].includes(
    normalize(text),
  );
}

function isNo(text: string) {
  return ["no", "n", "decline", "stop", "2"].includes(normalize(text));
}

function addChatEntry(session: UserSession, role: "user" | "assistant", text: string) {
  session.chatHistory.push({
    role,
    text,
    createdAt: new Date().toISOString(),
  });
  if (session.chatHistory.length > 50) session.chatHistory.shift();
}

async function send(session: UserSession, text: string, sendMessage: (text: string) => Promise<void>) {
  addChatEntry(session, "assistant", text);
  await sendMessage(text);
}

function slotMenu() {
  return `Here are the next available consultations:

1. ${availableSlots[0].label} — ${availableSlots[0].doctor} (${availableSlots[0].specialty})
2. ${availableSlots[1].label} — ${availableSlots[1].doctor} (${availableSlots[1].specialty})
3. ${availableSlots[2].label} — ${availableSlots[2].doctor} (${availableSlots[2].specialty})

Reply with 1, 2, or 3 to choose a slot.`;
}

export async function handleIncomingMessage(input: {
  phoneNumber: string;
  text: string;
  sendMessage: (text: string) => Promise<void>;
}) {
  const session = await getOrCreateSession(input.phoneNumber);
  const text = input.text.trim();
  if (!text) return session;
  addChatEntry(session, "user", text);

  if (normalize(text) === "stop") {
    session.consentAccepted = false;
    session.stage = "awaiting_consent";
    await saveSession(session);
    await send(
      session,
      "You have been opted out of Afeeyah AI messages. Reply YES any time to start again.",
      input.sendMessage,
    );
    await saveSession(session);
    return session;
  }

  if (normalize(text) === "menu" && session.stage !== "awaiting_consent") {
    session.stage = "menu";
    delete session.reminderDraft;
    await send(session, menu, input.sendMessage);
    await saveSession(session);
    return session;
  }

  switch (session.stage) {
    case "awaiting_name": {
      session.name = text.slice(0, 80);
      session.stage = "awaiting_consent";
      await send(session, `Thank you, ${session.name}.\n\n${consentNotice}`, input.sendMessage);
      break;
    }
    case "awaiting_consent": {
      if (isYes(text)) {
        session.consentAccepted = true;
        session.stage = "menu";
        await send(session, `Thank you. Your consent is recorded for this chat.\n\n${menu}`, input.sendMessage);
      } else if (isNo(text)) {
        session.consentAccepted = false;
        await send(session, "No problem. I won't continue without your consent. Reply YES if you want to start later.", input.sendMessage);
      } else {
        await send(session, "Please reply YES to consent or NO to stop.", input.sendMessage);
      }
      break;
    }
    case "awaiting_status": {
      const statusByChoice: Record<string, MaternaStatus> = {
        "1": "pregnant",
        pregnant: "pregnant",
        "2": "nursing",
        nursing: "nursing",
        "3": "planning",
        planning: "planning",
      };
      const status = statusByChoice[normalize(text)];
      if (!status) {
        await send(session, statusOptions, input.sendMessage);
        break;
      }
      session.status = status;
      session.stage = "menu";
      await send(session, menu, input.sendMessage);
      break;
    }
    case "menu": {
      const choice = normalize(text);
      if (choice === "1" || choice.includes("question")) {
        session.stage = "awaiting_question";
        await send(session, "Please type your health or wellbeing question. For emergencies, go to the nearest hospital immediately.", input.sendMessage);
      } else if (choice === "2" || choice.includes("doctor") || choice.includes("book")) {
        session.stage = "awaiting_slot";
        await send(session, slotMenu(), input.sendMessage);
      } else if (choice === "3" || choice.includes("remind")) {
        session.stage = "awaiting_reminder_text";
        delete session.reminderDraft;
        await send(
          session,
          "What should I remind you about? You can say doctor appointment, hospital visit, medication, or anything else.",
          input.sendMessage,
        );
      } else {
        await send(session, menu, input.sendMessage);
      }
      break;
    }
    case "awaiting_question": {
      if (normalize(text) === "menu") {
        session.stage = "menu";
        await send(session, menu, input.sendMessage);
        break;
      }
      try {
        const answer = await answerHealthQuestion(text, {
          status: session.status,
          language: session.preferredLanguage ?? session.language,
        });
        await send(session, `${answer}\n\nReply with another question, or send MENU to see your options again.`, input.sendMessage);
      } catch (error) {
        logger.warn({ error }, "Afeeyah AI could not answer a health question");
        await send(session, "Afeeyah AI is temporarily unable to answer. Please try again shortly, or contact a qualified clinician for medical advice.", input.sendMessage);
      }
      break;
    }
    case "awaiting_reminder_text": {
      session.reminderDraft = {
        text: text.slice(0, 160),
        category: classifyReminder(text),
      };
      session.stage = "awaiting_reminder_time";
      await send(
        session,
        `When should I remind you about "${session.reminderDraft.text}"?\n\nUse Nigeria time (${NIGERIA_UTC_OFFSET}, Africa/Lagos), for example:\n• tomorrow at 9am\n• 2026-09-15 14:30\n• 15/09/2026 14:30`,
        input.sendMessage,
      );
      break;
    }
    case "awaiting_reminder_time": {
      const draft = session.reminderDraft;
      const remindAt = parseNigeriaDateTime(text);
      if (!draft) {
        session.stage = "menu";
        await send(session, menu, input.sendMessage);
        break;
      }
      if (!remindAt || remindAt.getTime() <= Date.now()) {
        await send(
          session,
          `I couldn't understand that as a future Nigeria time. Please use one of these formats:\n• tomorrow at 9am\n• 2026-09-15 14:30\n• 15/09/2026 14:30`,
          input.sendMessage,
        );
        break;
      }

      const reminders = session.reminders ?? [];
      if (reminders.length >= 50) {
        session.stage = "menu";
        delete session.reminderDraft;
        await send(
          session,
          "You have reached the 50-reminder limit for this chat. Send MENU to continue.",
          input.sendMessage,
        );
        break;
      }

      const reminder = {
        id: randomUUID(),
        text: draft.text,
        category: draft.category,
        remindAt: remindAt.toISOString(),
        timezone: "Africa/Lagos" as const,
        createdAt: new Date().toISOString(),
      };
      reminders.push(reminder);
      session.reminders = reminders;
      session.reminderDraft = undefined;
      session.stage = "menu";
      await send(
        session,
        `Done. I'll remind you about your ${reminderCategoryLabel(reminder.category)}: "${reminder.text}" on ${formatNigeriaDateTime(remindAt)} (${NIGERIA_UTC_OFFSET}, Africa/Lagos).`,
        input.sendMessage,
      );
      break;
    }
    case "awaiting_slot": {
      const slot = availableSlots[Number.parseInt(normalize(text), 10) - 1];
      if (!slot) {
        await send(session, slotMenu(), input.sendMessage);
        break;
      }
      session.booking = {
        slotId: slot.id,
        slotLabel: slot.label,
        paymentStatus: "not_started",
      };
      session.stage = "awaiting_payment_email";
      await send(session, `You selected ${slot.label} with ${slot.doctor}. Please reply with your email address so we can prepare the secure Paystack payment link.`, input.sendMessage);
      break;
    }
    case "awaiting_payment_email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        await send(session, "Please reply with a valid email address, or send MENU to return to the main menu.", input.sendMessage);
        break;
      }
      const slot = availableSlots.find((item) => item.id === session.booking?.slotId);
      if (!slot || !session.booking) {
        session.stage = "menu";
        await send(session, menu, input.sendMessage);
        break;
      }
      session.booking.email = text;
      try {
        const payment = await initializePaystackPayment({
          email: text,
          slot,
          phoneNumber: session.phoneNumber,
        });
        if (!payment.configured) {
          session.booking.paymentStatus = "awaiting_provider_setup";
          await send(session, "Your doctor slot is saved, but secure payment is not enabled yet. An administrator must enable payments before Afeeyah AI can issue a payment link. Please do not send card details in WhatsApp.", input.sendMessage);
        } else {
          session.booking.paymentStatus = "pending";
          session.booking.authorizationUrl = payment.authorizationUrl;
          session.booking.reference = payment.reference;
          await send(session, `Your secure Paystack payment link is ready:\n${payment.authorizationUrl}\n\nComplete payment there, then keep your reference ${payment.reference} for confirmation.`, input.sendMessage);
        }
      } catch {
        await send(session, "I couldn't prepare the payment link right now. Your slot is not confirmed and no payment was taken. Please try again later.", input.sendMessage);
      }
      session.stage = "menu";
      break;
    }
  }

  await saveSession(session);
  return session;
}

export async function startConversation(phoneNumber: string, sendMessage: (text: string) => Promise<void>) {
  const session = await getOrCreateSession(phoneNumber);
  if (session.stage === "awaiting_name" && session.chatHistory.length === 0) {
    await send(session, "Welcome to Afeeyah AI, your health information assistant.\n\nWhat name should I use for you?", sendMessage);
    await saveSession(session);
  }
  return session;
}