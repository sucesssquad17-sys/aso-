import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for error tracking.
 * DSN should be provided in the environment variables.
 */
export const initErrorTracking = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
      // Performance Monitoring
      tracesSampleRate: import.meta.env.DEV ? 1 : 0.1,
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\/\/rankanalyzerpro\.com(?:\/|$)/],
      // Session Replay
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: import.meta.env.DEV ? 1 : 0.1,
    });
  }
};

/**
 * Log an error to Sentry and console.
 * @param error The error object or message
 * @param context Additional context for the error
 */
export const logError = (error: unknown, context?: Record<string, unknown>) => {
  console.error("Error logged:", error, context);
  
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context?.operation && typeof context.operation === "string") scope.setTag("operation", context.operation.slice(0, 100));
      if (context?.code && typeof context.code === "string") scope.setTag("error_code", context.code.slice(0, 100));
      if (context?.view && typeof context.view === "string") scope.setTag("view", context.view.slice(0, 100));
      Sentry.captureException(error);
    });
  }
};

/**
 * Get a user-friendly error message based on the error type.
 * @param error The error object
 * @returns A string message
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  
  const message = error?.message || "An unexpected error occurred";
  const code = error?.code;
  const status = error?.status;

  if (code === 'CONFIGURATION_ERROR') {
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes('portal') ||
      normalizedMessage.includes('customer portal')
    ) {
      return "Billing management is unavailable right now.";
    }

    if (
      normalizedMessage.includes('checkout') ||
      normalizedMessage.includes('billing') ||
      normalizedMessage.includes('dodo')
    ) {
      return "Billing is unavailable right now. Please try again shortly.";
    }

    if (
      normalizedMessage.includes('messaging') ||
      normalizedMessage.includes('notification') ||
      normalizedMessage.includes('push')
    ) {
      return "Notifications are unavailable right now.";
    }

    return "This service is unavailable right now. Please try again shortly.";
  }

  if (
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    code === 'BAD_REQUEST'
  ) {
    return message;
  }

  if (code === 'UPSTREAM_TIMEOUT' || code === 'REQUEST_TIMEOUT' || status === 504) {
    return "The app store request timed out. Please try again.";
  }

  if (code === 'UPSTREAM_UNAVAILABLE' || status === 503) {
    return "The app store is temporarily unavailable. Please try again shortly.";
  }

  if (code === 'NETWORK_ERROR') {
    return "Network error. Please check your internet connection.";
  }
  
  if (message.includes("quota")) {
    return "The service is currently busy. Please try again later.";
  }
  
  if (message.includes("network") || message.includes("fetch")) {
    return "Network error. Please check your internet connection.";
  }
  
  if (message.includes("permission") || message.includes("insufficient")) {
    return "You don't have permission to perform this action.";
  }

  if (message.includes("not found")) {
    return "The requested resource was not found.";
  }

  return "Something went wrong. Please try again.";
};
