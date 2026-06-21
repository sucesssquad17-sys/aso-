import { Fragment, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Toaster } from "sonner";
import {
  initializeFirebaseServices,
  isFirebaseConfigComplete,
  type FirebaseClientConfig,
  type FirebasePublicConfigResponse,
  RUNTIME_FIREBASE_ENV_KEYS,
} from "./firebase";
import { initErrorTracking } from "./lib/errorHandler";
import { applyTheme, getInitialTheme } from "./lib/theme";

if (
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  window.location.hostname === "127.0.0.1"
) {
  const redirectUrl = new URL(window.location.href);
  redirectUrl.hostname = "localhost";
  window.location.replace(redirectUrl.toString());
}

applyTheme(getInitialTheme());
initErrorTracking();

const AppRoot = import.meta.env.DEV ? Fragment : StrictMode;
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

type FirebaseBootstrapState =
  | {
      config: FirebaseClientConfig;
      configured: true;
      missingKeys: [];
      loadError: null;
    }
  | {
      config: null;
      configured: false;
      missingKeys: string[];
      loadError: string | null;
    };

function MissingFirebaseConfigScreen({
  loadError,
  missingKeys,
}: {
  loadError: string | null;
  missingKeys: string[];
}) {
  return (
    <div className="min-h-screen bg-app-surface text-app-text flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-app-surface-muted/90 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
          Local setup required
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-app-text">
          Firebase client config is unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-app-text-muted">
          The frontend now loads Firebase config from the running service at{" "}
          <code>/api/public-config</code>. Set the Firebase client env vars on the
          server runtime and reload.
        </p>
        <div className="mt-6 rounded-2xl border border-app-border bg-app-surface/70 p-4">
          <p className="text-sm text-amber-200">
            {loadError ||
              `Missing required Firebase client config: ${missingKeys.join(", ")}.`}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-app-text-muted">
            {(missingKeys.length > 0 ? missingKeys : RUNTIME_FIREBASE_ENV_KEYS).map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 text-xs text-app-text-muted">
          Reference: <code>.env.example</code> lists the required runtime variables
          for local, Docker, and Cloud Run service builds.
        </p>
      </div>
    </div>
  );
}

async function loadFirebaseBootstrapState(): Promise<FirebaseBootstrapState> {
  try {
    const response = await fetch("/api/public-config", {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return {
        config: null,
        configured: false,
        missingKeys: [...RUNTIME_FIREBASE_ENV_KEYS],
        loadError: `Failed to load /api/public-config (${response.status}).`,
      };
    }

    const payload = (await response.json()) as FirebasePublicConfigResponse;
    if (!payload.config || !isFirebaseConfigComplete(payload.config)) {
      return {
        config: null,
        configured: false,
        missingKeys:
          Array.isArray(payload.missingKeys) && payload.missingKeys.length > 0
            ? payload.missingKeys
            : [...RUNTIME_FIREBASE_ENV_KEYS],
        loadError: null,
      };
    }

    return {
      config: payload.config,
      configured: true,
      missingKeys: [],
      loadError: null,
    };
  } catch (error) {
    return {
      config: null,
      configured: false,
      missingKeys: [...RUNTIME_FIREBASE_ENV_KEYS],
      loadError:
        error instanceof Error
          ? error.message
          : "Failed to load Firebase client configuration.",
    };
  }
}

const root = createRoot(rootElement);

async function bootstrap() {
  const firebaseState = await loadFirebaseBootstrapState();

  if (!firebaseState.configured) {
    root.render(
      <AppRoot>
        <MissingFirebaseConfigScreen
          loadError={firebaseState.loadError}
          missingKeys={firebaseState.missingKeys}
        />
        <Toaster position="top-right" richColors />
      </AppRoot>,
    );
    return;
  }

  initializeFirebaseServices(firebaseState.config);
  const { default: App } = await import("./App.tsx");

  root.render(
    <AppRoot>
      <App />
      <Toaster position="top-right" richColors />
    </AppRoot>,
  );
}

void bootstrap();
