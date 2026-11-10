import { logger } from "../lib/logger";
import type { AvailableSlot } from "./types";

export const availableSlots: AvailableSlot[] = [
  {
    id: "slot-1",
    label: "Tuesday, 10 September at 10:00 WAT",
    doctor: "Dr. Adaeze Okafor",
    specialty: "Obstetrics",
    priceKobo: 1500000,
  },
  {
    id: "slot-2",
    label: "Wednesday, 11 September at 14:30 WAT",
    doctor: "Dr. Chinedu Eze",
    specialty: "Paediatrics",
    priceKobo: 1200000,
  },
  {
    id: "slot-3",
    label: "Friday, 13 September at 09:00 WAT",
    doctor: "Dr. Amina Bello",
    specialty: "Obstetrics",
    priceKobo: 1500000,
  },
];

export function getPaymentStatus() {
  return { configured: Boolean(process.env.PAYSTACK_SECRET_KEY) };
}

type PaystackResponse = {
  status?: boolean;
  message?: string;
  data?: { authorization_url?: string; reference?: string };
};

export async function initializePaystackPayment(input: {
  email: string;
  slot: AvailableSlot;
  phoneNumber: string;
}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return {
      configured: false as const,
      authorizationUrl: undefined,
      reference: undefined,
    };
  }

  const reference = `materna_${Date.now()}_${input.phoneNumber.replace(/\D/g, "").slice(-8)}`;
  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.slot.priceKobo,
        reference,
        metadata: {
          phoneNumber: input.phoneNumber,
          slotId: input.slot.id,
          doctor: input.slot.doctor,
        },
      }),
    },
  );

  const payload = (await response.json()) as PaystackResponse;
  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    logger.warn({ status: response.status }, "Paystack initialization failed");
    throw new Error(payload.message ?? "Paystack initialization failed.");
  }

  return {
    configured: true as const,
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference ?? reference,
  };
}