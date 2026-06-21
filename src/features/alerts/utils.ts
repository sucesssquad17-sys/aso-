import type { AlertConditionType } from "../../lib/alerts";

export function createAlertRuleId() {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatAlertEventTime(timestamp: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

export function conditionNeedsThreshold(conditionType: AlertConditionType) {
  return (
    conditionType === "enter_top_n" ||
    conditionType === "leave_top_n" ||
    conditionType === "improve_by" ||
    conditionType === "drop_by"
  );
}
