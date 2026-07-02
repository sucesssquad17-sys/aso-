import { normalizeCountryCode } from "./countries";

export type AlertStoreType = "android" | "ios";

export type AlertConditionType =
  | "enter_top_n"
  | "leave_top_n"
  | "improve_by"
  | "drop_by"
  | "starts_ranking"
  | "stops_ranking"
  | "check_error"
  | "aso_any_change"
  | "aso_title_changed"
  | "aso_description_changed"
  | "aso_screenshots_changed"
  | "aso_icon_changed"
  | "aso_category_changed";

export type AlertRuleScope = "keyword" | "competitor_aso";

export type AlertCondition = {
  type: AlertConditionType;
  value?: number;
};

export type AlertChannels = {
  inApp: boolean;
  push: boolean;
  email: boolean;
};

export type AlertRule = {
  id: string;
  enabled: boolean;
  groupId: string;
  appId: string;
  keyword: string;
  store: AlertStoreType;
  scope?: AlertRuleScope;
  countries: string[];
  channels: AlertChannels;
  conditions: AlertCondition[];
  targetAppIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  baselineKeys?: string[];
};

export type NotificationSettings = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  permission: NotificationPermission | "unsupported";
  lastToken?: string;
  lastTokenId?: string;
  tokenUpdatedAt?: string;
};

export type AlertEvent = {
  id: string;
  ruleId: string;
  groupId: string;
  appId: string;
  keyword: string;
  store: AlertStoreType;
  country: string;
  eventType: AlertConditionType;
  scope?: AlertRuleScope;
  previousRank: number | null;
  currentRank: number | null;
  threshold: number | null;
  message: string;
  changedAppId?: string;
  changedAppTitle?: string;
  changedFields?: string[];
  createdAt: string;
  readAt?: string | null;
  emailDeliveryStatus?: "delivered" | "failed";
  emailDeliveryRecipient?: string;
  emailDeliveryAttemptedAt?: string;
  emailDeliveryDeliveredAt?: string;
  emailDeliveryFailedAt?: string;
  emailDeliveryLastError?: string;
};

export type AlertPreset = {
  id: string;
  label: string;
  description: string;
  conditions: AlertCondition[];
};

export const KEYWORD_ALERT_CONDITION_TYPES: AlertConditionType[] = [
  "enter_top_n",
  "leave_top_n",
  "improve_by",
  "drop_by",
  "starts_ranking",
  "stops_ranking",
  "check_error",
];

export const COMPETITOR_ASO_ALERT_CONDITION_TYPES: AlertConditionType[] = [
  "aso_any_change",
  "aso_title_changed",
  "aso_description_changed",
  "aso_screenshots_changed",
  "aso_icon_changed",
  "aso_category_changed",
];

export const ALERT_CONDITION_LABELS: Record<AlertConditionType, string> = {
  enter_top_n: "Enter Top N",
  leave_top_n: "Leave Top N",
  improve_by: "Improve By",
  drop_by: "Drop By",
  starts_ranking: "Starts Ranking",
  stops_ranking: "Stops Ranking",
  check_error: "Check Error",
  aso_any_change: "Any ASO Change",
  aso_title_changed: "Title Changed",
  aso_description_changed: "Description Changed",
  aso_screenshots_changed: "Screenshots Changed",
  aso_icon_changed: "Icon Changed",
  aso_category_changed: "Category Changed",
};

export const ALERT_PRESETS: AlertPreset[] = [
  {
    id: "top-10",
    label: "Top 10 watcher",
    description: "Alert when the keyword enters or leaves the Top 10.",
    conditions: [
      { type: "enter_top_n", value: 10 },
      { type: "leave_top_n", value: 10 },
    ],
  },
  {
    id: "volatility",
    label: "Volatility watcher",
    description: "Alert when the rank moves sharply in either direction.",
    conditions: [
      { type: "improve_by", value: 5 },
      { type: "drop_by", value: 5 },
    ],
  },
  {
    id: "ranking-state",
    label: "Ranking started/stopped",
    description: "Alert when the keyword starts ranking or drops out.",
    conditions: [
      { type: "starts_ranking" },
      { type: "stops_ranking" },
    ],
  },
  {
    id: "failures",
    label: "Failure watcher",
    description: "Alert when the rank check fails for this keyword.",
    conditions: [{ type: "check_error" }],
  },
];

export const COMPETITOR_ASO_ALERT_PRESETS: AlertPreset[] = [
  {
    id: "aso-any",
    label: "Any ASO change",
    description: "Alert whenever any tracked ASO field changes.",
    conditions: [{ type: "aso_any_change" }],
  },
  {
    id: "aso-copy",
    label: "Copy watcher",
    description: "Alert when the title or description changes.",
    conditions: [
      { type: "aso_title_changed" },
      { type: "aso_description_changed" },
    ],
  },
  {
    id: "aso-creative",
    label: "Creative watcher",
    description: "Alert when the icon or screenshots change.",
    conditions: [
      { type: "aso_icon_changed" },
      { type: "aso_screenshots_changed" },
    ],
  },
];

export function getDefaultNotificationSettings(
  permission?: NotificationPermission | "unsupported",
): NotificationSettings {
  const resolvedPermission = permission || "default";
  return {
    inAppEnabled: true,
    pushEnabled: resolvedPermission === "granted",
    permission: resolvedPermission,
  };
}

export function normalizeAlertCondition(
  input: unknown,
): AlertCondition | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<AlertCondition>;
  if (
    candidate.type !== "enter_top_n" &&
    candidate.type !== "leave_top_n" &&
    candidate.type !== "improve_by" &&
    candidate.type !== "drop_by" &&
    candidate.type !== "starts_ranking" &&
    candidate.type !== "stops_ranking" &&
    candidate.type !== "check_error" &&
    candidate.type !== "aso_any_change" &&
    candidate.type !== "aso_title_changed" &&
    candidate.type !== "aso_description_changed" &&
    candidate.type !== "aso_screenshots_changed" &&
    candidate.type !== "aso_icon_changed" &&
    candidate.type !== "aso_category_changed"
  ) {
    return null;
  }
  const needsValue =
    candidate.type === "enter_top_n" ||
    candidate.type === "leave_top_n" ||
    candidate.type === "improve_by" ||
    candidate.type === "drop_by";
  const rawValue =
    typeof candidate.value === "number"
      ? candidate.value
      : Number(candidate.value);
  const value =
    needsValue && Number.isFinite(rawValue) && rawValue > 0
      ? Math.round(rawValue)
      : undefined;
  if (needsValue && !value) {
    return null;
  }
  return {
    type: candidate.type,
    ...(value ? { value } : {}),
  };
}

export function normalizeAlertRule(input: unknown): AlertRule | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<AlertRule>;
  if (
    typeof candidate.id !== "string" ||
    !candidate.id.trim() ||
    typeof candidate.groupId !== "string" ||
    !candidate.groupId.trim() ||
    typeof candidate.appId !== "string" ||
    !candidate.appId.trim() ||
    typeof candidate.keyword !== "string" ||
    !candidate.keyword.trim() ||
    (candidate.store !== "android" && candidate.store !== "ios")
  ) {
    return null;
  }
  const countries = Array.isArray(candidate.countries)
    ? Array.from(
        new Set(
          candidate.countries
            .filter((country) => typeof country === "string" && country.trim())
            .map((country) => normalizeCountryCode(country, ""))
            .filter((country) => Boolean(country)),
        ),
      )
    : [];
  const channels = {
    inApp: Boolean(candidate.channels?.inApp ?? true),
    push: Boolean(candidate.channels?.push),
    email: Boolean(candidate.channels?.email),
  };
  const conditions = Array.isArray(candidate.conditions)
    ? candidate.conditions
        .map((condition) => normalizeAlertCondition(condition))
        .filter((condition): condition is AlertCondition => Boolean(condition))
    : [];
  if (
    !countries.length ||
    !conditions.length ||
    (!channels.inApp && !channels.push && !channels.email)
  ) {
    return null;
  }
  return {
    id: candidate.id.trim(),
    enabled: candidate.enabled !== false,
    groupId: candidate.groupId.trim(),
    appId: candidate.appId.trim(),
    keyword: candidate.keyword.trim(),
    store: candidate.store,
    scope: candidate.scope === "competitor_aso" ? "competitor_aso" : "keyword",
    countries,
    channels,
    conditions,
    ...(Array.isArray(candidate.targetAppIds)
      ? {
          targetAppIds: Array.from(
            new Set(
              candidate.targetAppIds
                .filter((entry) => typeof entry === "string" && entry.trim())
                .map((entry) => entry.trim()),
            ),
          ),
        }
      : {}),
    ...(typeof candidate.createdAt === "string"
      ? { createdAt: candidate.createdAt }
      : {}),
    ...(typeof candidate.updatedAt === "string"
      ? { updatedAt: candidate.updatedAt }
      : {}),
    ...(Array.isArray(candidate.baselineKeys)
      ? {
          baselineKeys: Array.from(
            new Set(
              candidate.baselineKeys
                .filter((entry) => typeof entry === "string" && entry.trim())
                .map((entry) => entry.trim()),
            ),
          ),
        }
      : {}),
  };
}

export function normalizeAlertRules(input: unknown): AlertRule[] {
  return Array.isArray(input)
    ? input
        .map((rule) => normalizeAlertRule(rule))
        .filter((rule): rule is AlertRule => Boolean(rule))
    : [];
}

export function normalizeNotificationSettings(
  input: unknown,
  permissionFallback?: NotificationPermission | "unsupported",
): NotificationSettings {
  if (!input || typeof input !== "object") {
    return getDefaultNotificationSettings(permissionFallback);
  }
  const candidate = input as Partial<NotificationSettings>;
  const permission =
    candidate.permission === "granted" ||
    candidate.permission === "denied" ||
    candidate.permission === "default" ||
    candidate.permission === "unsupported"
      ? candidate.permission
      : permissionFallback || "default";
  return {
    inAppEnabled: candidate.inAppEnabled !== false,
    pushEnabled:
      typeof candidate.pushEnabled === "boolean"
        ? candidate.pushEnabled
        : permission === "granted",
    permission,
    ...(typeof candidate.lastToken === "string" && candidate.lastToken
      ? { lastToken: candidate.lastToken }
      : {}),
    ...(typeof candidate.lastTokenId === "string" && candidate.lastTokenId
      ? { lastTokenId: candidate.lastTokenId }
      : {}),
    ...(typeof candidate.tokenUpdatedAt === "string"
      ? { tokenUpdatedAt: candidate.tokenUpdatedAt }
      : {}),
  };
}

export function describeAlertCondition(condition: AlertCondition): string {
  switch (condition.type) {
    case "enter_top_n":
      return `enters top ${condition.value}`;
    case "leave_top_n":
      return `leaves top ${condition.value}`;
    case "improve_by":
      return `improves by ${condition.value}+`;
    case "drop_by":
      return `drops by ${condition.value}+`;
    case "starts_ranking":
      return "starts ranking";
    case "stops_ranking":
      return "stops ranking";
    case "check_error":
      return "check fails";
    case "aso_any_change":
      return "any ASO change";
    case "aso_title_changed":
      return "title changes";
    case "aso_description_changed":
      return "description changes";
    case "aso_screenshots_changed":
      return "screenshots change";
    case "aso_icon_changed":
      return "icon changes";
    case "aso_category_changed":
      return "category changes";
  }
}

export function buildAlertRuleSummary(rule: AlertRule): string {
  const scope =
    rule.countries.length === 1 && rule.countries[0]
      ? rule.countries[0].toUpperCase()
      : `${rule.countries.length} countries`;
  return `${rule.conditions.map(describeAlertCondition).join(", ")} in ${scope}`;
}
