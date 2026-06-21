export type DailyTrackingSummary = {
  scanned: number;
  ran: number;
  checked: number;
  changed: number;
  failed: number;
  asoChecked: number;
  asoChanged: number;
  asoFailed: number;
};

export const DAILY_TRACKING_LEASE_TTL_MINUTES = 180;

export function getEmptyDailyTrackingSummary(): DailyTrackingSummary {
  return {
    scanned: 0,
    ran: 0,
    checked: 0,
    changed: 0,
    failed: 0,
    asoChecked: 0,
    asoChanged: 0,
    asoFailed: 0,
  };
}

export function getDailyTrackingFinalStatus(summary: DailyTrackingSummary) {
  return summary.failed > 0 || summary.asoFailed > 0 ? 'partial' : 'success';
}

export function shouldRetryPartialDailyTracking(summary: DailyTrackingSummary) {
  const totalAttempts = summary.checked + summary.asoChecked;
  const totalFailures = summary.failed + summary.asoFailed;

  if (totalFailures <= 0) {
    return false;
  }
  if (totalAttempts <= 0) {
    return true;
  }

  return totalFailures >= 5 || totalFailures / totalAttempts >= 0.25;
}
