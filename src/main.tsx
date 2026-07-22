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

applyTheme(getInitialTheme());
initErrorTracking();

const AppRoot = import.meta.env.DEV ? StrictMode : Fragment;
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
  const isDevelopment = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-app-surface text-app-text flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-app-border bg-app-surface-muted/90 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Connection unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-app-text">
          We could not load your workspace right now
        </h1>
        <p className="mt-3 text-sm leading-6 text-app-text-muted">
          Rank Analyzer Pro needs a network connection to start your secure session. Check your connection, then retry.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex rounded-full bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
        >
          Retry
        </button>
        {isDevelopment ? (
          <>
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-app-surface/70 p-4">
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
              Development reference: <code>.env.example</code> lists the required runtime variables
              for local, Docker, and Cloud Run service builds.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function StartupScreen() {
  return (
    <div className="min-h-screen bg-app-surface text-app-text flex items-center justify-center p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-full border border-app-border bg-app-surface-muted/90 px-5 py-3 shadow-lg">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-r-transparent" aria-hidden="true" />
        <span className="text-sm font-semibold">Opening your workspace...</span>
      </div>
    </div>
  );
}

async function loadFirebaseBootstrapState(): Promise<FirebaseBootstrapState> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/public-config", {
      cache: "no-store",
      signal: controller.signal,
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
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const root = createRoot(rootElement);
root.render(
  <AppRoot>
    <StartupScreen />
  </AppRoot>,
);

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

  try {
    initializeFirebaseServices(firebaseState.config);
    const { default: App } = await import("./App.tsx");

    root.render(
      <AppRoot>
        <App />
        <Toaster position="top-right" richColors />
      </AppRoot>,
    );
  } catch (error) {
    root.render(
      <AppRoot>
        <MissingFirebaseConfigScreen
          loadError={error instanceof Error ? `Application failed to load: ${error.message}` : "Application failed to load."}
          missingKeys={[]}
        />
        <Toaster position="top-right" richColors />
      </AppRoot>,
    );
  }
}

void bootstrap();
