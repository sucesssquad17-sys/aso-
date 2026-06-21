import { GoogleAuthProvider } from "firebase/auth";

export type GoogleSignInFlow = "popup" | "redirect";

type PendingGoogleRedirectAttempt = {
  attemptId: string;
  flow: "redirect";
  provider: "google";
  startedAt: string;
};

const PENDING_GOOGLE_REDIRECT_ATTEMPT_KEY = "aso-google-redirect-attempt";
const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function createAuthAttemptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export function detectGoogleSignInFlow(): GoogleSignInFlow {
  if (typeof navigator === "undefined") {
    return "popup";
  }

  return MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent || "")
    ? "redirect"
    : "popup";
}

export function persistPendingGoogleRedirectAttempt(attemptId: string) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  const value: PendingGoogleRedirectAttempt = {
    attemptId,
    flow: "redirect",
    provider: "google",
    startedAt: new Date().toISOString(),
  };

  storage.setItem(PENDING_GOOGLE_REDIRECT_ATTEMPT_KEY, JSON.stringify(value));
}

export function readPendingGoogleRedirectAttempt(): PendingGoogleRedirectAttempt | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(PENDING_GOOGLE_REDIRECT_ATTEMPT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingGoogleRedirectAttempt>;
    if (
      typeof parsed?.attemptId === "string" &&
      parsed.flow === "redirect" &&
      parsed.provider === "google" &&
      typeof parsed.startedAt === "string"
    ) {
      return {
        attemptId: parsed.attemptId,
        flow: "redirect",
        provider: "google",
        startedAt: parsed.startedAt,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function clearPendingGoogleRedirectAttempt() {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(PENDING_GOOGLE_REDIRECT_ATTEMPT_KEY);
}

export function getAuthErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return String((error as { code?: unknown }).code);
  }

  return undefined;
}

export function getShortAuthErrorMessage(error: unknown, maxLength = 240) {
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = String((error as { message?: unknown }).message).trim();
    if (message) {
      return message.slice(0, maxLength);
    }
  }

  return undefined;
}
