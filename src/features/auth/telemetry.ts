import type { GoogleSignInFlow } from "./googleSignIn";

export type AuthEventPayload = {
  attemptId: string;
  provider: "google";
  flow: GoogleSignInFlow;
  phase: "start" | "success" | "error";
  host: string;
  path: string;
  userAgent: string;
  errorCode?: string;
  errorMessage?: string;
  occurredAt: string;
};

const AUTH_EVENTS_ENDPOINT = "/api/auth/events";

export async function sendAuthEvent(
  payload: AuthEventPayload,
  options?: { preferBeacon?: boolean },
) {
  const body = JSON.stringify(payload);

  if (
    options?.preferBeacon &&
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(AUTH_EVENTS_ENDPOINT, blob)) {
        return true;
      }
    } catch {
      // Fall through to fetch.
    }
  }

  if (typeof fetch !== "function") {
    return false;
  }

  try {
    await fetch(AUTH_EVENTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      keepalive: options?.preferBeacon === true,
    });
    return true;
  } catch {
    return false;
  }
}
