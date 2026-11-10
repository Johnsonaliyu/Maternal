export type MaternaStatus = "pregnant" | "nursing" | "planning";

export type ConversationStage =
  | "awaiting_name"
  | "awaiting_consent"
  | "awaiting_status"
  | "menu"
  | "awaiting_question"
  | "awaiting_reminder_text"
  | "awaiting_reminder_time"
  | "awaiting_slot"
  | "awaiting_payment_email";

export type ChatEntry = {
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type Booking = {
  slotId: string;
  slotLabel: string;
  email?: string;
  paymentStatus: "not_started" | "awaiting_provider_setup" | "pending";
  authorizationUrl?: string;
  reference?: string;
};

export type ReminderCategory = "doctor" | "hospital" | "medication" | "other";

export type ReminderDraft = {
  text: string;
  category: ReminderCategory;
};

export type Reminder = {
  id: string;
  text: string;
  category: ReminderCategory;
  remindAt: string;
  timezone: "Africa/Lagos";
  createdAt: string;
  sentAt?: string;
};

export type UserSession = {
  phoneNumber: string;
  name?: string;
  language: string;
  status?: MaternaStatus;
  stage: ConversationStage;
  consentAccepted: boolean;
  medicalHistory: string[];
  location?: string;
  preferredLanguage?: string;
  booking?: Booking;
  reminderDraft?: ReminderDraft;
  reminders?: Reminder[];
  chatHistory: ChatEntry[];
  createdAt: string;
  updatedAt: string;
};

export type AvailableSlot = {
  id: string;
  label: string;
  doctor: string;
  specialty: string;
  priceKobo: number;
};