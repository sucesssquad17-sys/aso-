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
        Sentry.replayIntegration(),
      ],
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\/\/ais-dev-.*\.run\.app/],
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    });
    console.log("Sentry initialized");
  } else {
    console.warn("Sentry DSN not found. Error tracking is disabled.");
  }
};

/**
 * Log an error to Sentry and console.
 * @param error The error object or message
 * @param context Additional context for the error
 */
export const logError = (error: any, context?: Record<string, any>) => {
  console.error("Error logged:", error, context);
  
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
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

  return "Something went wrong. Our team has been notified.";
};
