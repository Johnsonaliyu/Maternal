import type { ReminderCategory } from "./types";

export const NIGERIA_TIME_ZONE = "Africa/Lagos";
export const NIGERIA_UTC_OFFSET = "UTC+1";

type NigeriaDateParts = {
  year: number;
  month: number;
  day: number;
};

function getNigeriaDateParts(date: Date): NigeriaDateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NIGERIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function parseClock(
  hourText: string,
  minuteText = "0",
  meridiem?: string,
) {
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return undefined;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return undefined;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return undefined;
  }

  return { hour, minute };
}

function toNigeriaDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  if (![year, month, day, hour, minute].every(Number.isInteger)) return undefined;

  // Nigeria has a fixed UTC+1 offset, so local midnight is 23:00 UTC
  // on the previous day. The round-trip check rejects impossible dates.
  const timestamp = Date.UTC(year, month - 1, day, hour - 1, minute);
  const date = new Date(timestamp);
  const parts = getNigeriaDateParts(date);
  const displayed = new Intl.DateTimeFormat("en-GB", {
    timeZone: NIGERIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const displayedHour = Number(displayed.find((part) => part.type === "hour")?.value);
  const displayedMinute = Number(displayed.find((part) => part.type === "minute")?.value);

  if (
    parts.year !== year ||
    parts.month !== month ||
    parts.day !== day ||
    displayedHour !== hour ||
    displayedMinute !== minute
  ) {
    return undefined;
  }

  return date;
}

export function parseNigeriaDateTime(input: string, now = new Date()) {
  const text = input.trim().toLowerCase().replace(/\s+/g, " ");
  const relative = text.match(
    /^(today|tomorrow)(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/,
  );

  if (relative) {
    const clock = parseClock(relative[2], relative[3], relative[4]);
    if (!clock) return undefined;
    const current = getNigeriaDateParts(now);
    const dayOffset = relative[1] === "tomorrow" ? 1 : 0;
    const date = new Date(Date.UTC(current.year, current.month - 1, current.day + dayOffset));
    return toNigeriaDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      clock.hour,
      clock.minute,
    );
  }

  const iso = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/,
  );
  if (iso) {
    const clock = parseClock(iso[4], iso[5], iso[6]);
    return clock
      ? toNigeriaDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), clock.hour, clock.minute)
      : undefined;
  }

  const local = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/,
  );
  if (local) {
    const clock = parseClock(local[4], local[5], local[6]);
    return clock
      ? toNigeriaDate(Number(local[3]), Number(local[2]), Number(local[1]), clock.hour, clock.minute)
      : undefined;
  }

  return undefined;
}

export function formatNigeriaDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: NIGERIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function classifyReminder(text: string): ReminderCategory {
  const normalized = text.toLowerCase();
  if (/\b(doctor|appointment|clinic|consultation)\b/.test(normalized)) return "doctor";
  if (/\b(hospital|scan|surgery|operation|procedure)\b/.test(normalized)) return "hospital";
  if (/\b(medication|medicine|tablet|capsule|drug|dose|injection)\b/.test(normalized)) return "medication";
  return "other";
}

export function reminderCategoryLabel(category: ReminderCategory) {
  return {
    doctor: "doctor appointment",
    hospital: "hospital visit",
    medication: "medication",
    other: "personal reminder",
  }[category];
}