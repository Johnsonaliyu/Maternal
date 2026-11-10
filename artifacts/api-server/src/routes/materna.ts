import { Router, type IRouter } from "express";
import { getAiProviderStatus } from "../materna/aiHandler";
import { getPaymentStatus } from "../materna/payment";
import { countSessions, getSession } from "../materna/sessionStore";
import {
  getWhatsAppStatus,
  previewConversation,
  previewConversationStart,
  resetWhatsAppPairing,
} from "../materna/whatsapp";

const router: IRouter = Router();

router.get("/materna/status", async (_req, res) => {
  res.json({
    whatsapp: getWhatsAppStatus(),
    ai: getAiProviderStatus(),
    paystack: getPaymentStatus(),
    sessions: await countSessions(),
  });
});

router.post("/materna/whatsapp/reset", async (_req, res) => {
  try {
    await resetWhatsAppPairing();
    res.json({ status: getWhatsAppStatus() });
  } catch (error) {
    res.status(409).json({
      error: error instanceof Error ? error.message : "Could not reset WhatsApp pairing.",
    });
  }
});

router.get("/materna/sessions/:phoneNumber", async (req, res) => {
  const session = await getSession(req.params.phoneNumber);
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  res.json(session);
});

router.post("/materna/preview/start", async (req, res) => {
  const phoneNumber = String(req.body?.phoneNumber ?? "").trim();
  if (!phoneNumber) {
    res.status(400).json({ error: "phoneNumber is required." });
    return;
  }
  res.json({ messages: await previewConversationStart(phoneNumber) });
});

router.post("/materna/preview/message", async (req, res) => {
  const phoneNumber = String(req.body?.phoneNumber ?? "").trim();
  const text = String(req.body?.text ?? "").trim();
  if (!phoneNumber || !text) {
    res.status(400).json({ error: "phoneNumber and text are required." });
    return;
  }
  res.json({ messages: await previewConversation(phoneNumber, text) });
});

export default router;