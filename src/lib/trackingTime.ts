export const GLOBAL_TRACKING_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_GLOBAL_TRACKING_TIME = "09:00";
export const TRACKING_CHART_TIMEZONE = GLOBAL_TRACKING_TIMEZONE;
export const GLOBAL_TRACKING_UTC_OFFSET_MINUTES = 330;

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value || "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value || "1");
  const day = Number(parts.find((part) => part.type === "day")?.value || "1");
  return { year, month, day };
}

function parseTrackingTimeParts(time: string) {
  const [hoursText = "0", minutesText = "0"] = String(time).split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return { hours: 9, minutes: 0 };
  }
  return { hours, minutes };
}

export function formatGlobalTrackingTimeForLocalDisplay(
  referenceDate = new Date(),
  options?: {
    locale?: string;
    includeTimeZoneName?: boolean;
  },
) {
  const { year, month, day } = getZonedDateParts(
    referenceDate,
    GLOBAL_TRACKING_TIMEZONE,
  );
  const { hours, minutes } = parseTrackingTimeParts(DEFAULT_GLOBAL_TRACKING_TIME);
  const utcTimestamp =
    Date.UTC(year, month - 1, day, hours, minutes) -
    GLOBAL_TRACKING_UTC_OFFSET_MINUTES * 60 * 1000;

  return new Intl.DateTimeFormat(options?.locale, {
    hour: "numeric",
    minute: "2-digit",
    ...(options?.includeTimeZoneName ? { timeZoneName: "short" as const } : {}),
  }).format(new Date(utcTimestamp));
}
