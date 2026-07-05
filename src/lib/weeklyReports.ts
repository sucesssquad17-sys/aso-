import { normalizeValidTimeZone } from "./trackingTime";

export const WEEKLY_REPORT_WEEKDAYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

export type WeeklyReportWeekday = (typeof WEEKLY_REPORT_WEEKDAYS)[number];

export type WeeklyReportSettings = {
  enabled: boolean;
  weekday: WeeklyReportWeekday;
  timezone: string;
  lastSentWeekKey?: string;
  lastSentAt?: string;
  lastAttemptedAt?: string;
  lastDeliveryStatus?: "delivered" | "failed";
  lastDeliveryError?: string;
};

export const DEFAULT_WEEKLY_REPORT_WEEKDAY: WeeklyReportWeekday = "sun";

export const WEEKLY_REPORT_WEEKDAY_LABELS: Record<
  WeeklyReportWeekday,
  string
> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

export function normalizeWeeklyReportWeekday(
  input: unknown,
): WeeklyReportWeekday {
  return typeof input === "string" &&
    WEEKLY_REPORT_WEEKDAYS.includes(input as WeeklyReportWeekday)
    ? (input as WeeklyReportWeekday)
    : DEFAULT_WEEKLY_REPORT_WEEKDAY;
}

export function getDefaultWeeklyReportSettings(
  fallbackTimezone = "UTC",
): WeeklyReportSettings {
  return {
    enabled: false,
    weekday: DEFAULT_WEEKLY_REPORT_WEEKDAY,
    timezone: normalizeValidTimeZone(fallbackTimezone, "UTC"),
  };
}

export function normalizeWeeklyReportSettings(
  input?: Partial<WeeklyReportSettings> | null,
  fallbackTimezone = "UTC",
): WeeklyReportSettings {
  const defaults = getDefaultWeeklyReportSettings(fallbackTimezone);
  return {
    enabled: typeof input?.enabled === "boolean" ? input.enabled : false,
    weekday: normalizeWeeklyReportWeekday(input?.weekday),
    timezone: normalizeValidTimeZone(input?.timezone, defaults.timezone),
    lastSentWeekKey:
      typeof input?.lastSentWeekKey === "string" && input.lastSentWeekKey.trim()
        ? input.lastSentWeekKey.trim()
        : undefined,
    lastSentAt:
      typeof input?.lastSentAt === "string" && input.lastSentAt.trim()
        ? input.lastSentAt.trim()
        : undefined,
    lastAttemptedAt:
      typeof input?.lastAttemptedAt === "string" && input.lastAttemptedAt.trim()
        ? input.lastAttemptedAt.trim()
        : undefined,
    lastDeliveryStatus:
      input?.lastDeliveryStatus === "delivered" ||
      input?.lastDeliveryStatus === "failed"
        ? input.lastDeliveryStatus
        : undefined,
    lastDeliveryError:
      typeof input?.lastDeliveryError === "string" &&
      input.lastDeliveryError.trim()
        ? input.lastDeliveryError.trim()
        : undefined,
  };
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: String(parts.year),
    month: String(parts.month),
    day: String(parts.day),
    weekday: String(parts.weekday).toLowerCase(),
  };
}

function getUtcDateFromZonedParts(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
}

export function getWeeklyReportRangeEndDate(date: Date, timeZone: string) {
  return getUtcDateFromZonedParts(date, timeZone);
}

export function getWeeklyReportRangeStartDate(date: Date, timeZone: string) {
  const rangeStart = getUtcDateFromZonedParts(date, timeZone);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 6);
  return rangeStart;
}

export function getWeeklyReportRangeStartIso(date: Date, timeZone: string) {
  return getWeeklyReportRangeStartDate(date, timeZone).toISOString();
}

export function getWeeklyReportDateStamp(date: Date, timeZone: string) {
  return getUtcDateFromZonedParts(date, timeZone).getTime();
}

export function formatWeeklyReportRangeLabel(
  date: Date,
  timeZone: string,
  locale = "en-US",
) {
  const rangeStart = getWeeklyReportRangeStartDate(date, timeZone);
  const rangeEnd = getWeeklyReportRangeEndDate(date, timeZone);
  return `${rangeStart.toLocaleDateString(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  })} - ${rangeEnd.toLocaleDateString(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function getWeeklyReportLocalWeekday(
  date: Date,
  timeZone: string,
): WeeklyReportWeekday {
  const weekday = getZonedParts(date, timeZone).weekday;
  return weekday === "sun" ||
    weekday === "mon" ||
    weekday === "tue" ||
    weekday === "wed" ||
    weekday === "thu" ||
    weekday === "fri" ||
    weekday === "sat"
    ? weekday
    : DEFAULT_WEEKLY_REPORT_WEEKDAY;
}

export function getWeeklyReportDeliveryKey(date: Date, timeZone: string) {
  const zonedDate = getUtcDateFromZonedParts(date, timeZone);
  const day = zonedDate.getUTCDay() || 7;
  zonedDate.setUTCDate(zonedDate.getUTCDate() + 4 - day);
  const isoYear = zonedDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((zonedDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function shouldSendWeeklyReportForDate(
  settings: WeeklyReportSettings,
  date: Date,
) {
  const deliveryKey = getWeeklyReportDeliveryKey(date, settings.timezone);
  return {
    deliveryKey,
    matchesWeekday:
      getWeeklyReportLocalWeekday(date, settings.timezone) === settings.weekday,
    alreadySent: settings.lastSentWeekKey === deliveryKey,
  };
}
