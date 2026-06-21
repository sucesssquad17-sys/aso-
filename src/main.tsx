import { Fragment, StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initErrorTracking } from './lib/errorHandler';
import { applyTheme, getInitialTheme } from './lib/theme';
import { Toaster } from 'sonner';
import { firebaseConfigError, firebaseConfigErrorDetails } from './firebase';

if (
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.location.hostname === '127.0.0.1'
) {
  const redirectUrl = new URL(window.location.href);
  redirectUrl.hostname = 'localhost';
  window.location.replace(redirectUrl.toString());
}

applyTheme(getInitialTheme());
initErrorTracking();
const AppRoot = import.meta.env.DEV ? Fragment : StrictMode;
const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

function MissingFirebaseConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-slate-900/90 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
          Local setup required
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Firebase client env vars are missing
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Add the missing Firebase client config in local <code>.env</code> or in
          <code> firebase-applet-config.json</code>, then reload localhost.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
          <p className="text-sm text-amber-200">{firebaseConfigError}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {firebaseConfigErrorDetails.missingKeys.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Reference: <code>.env.example</code> includes the env keys, and
          <code> firebase-applet-config.json</code> can provide the same client config.
        </p>
      </div>
    </div>
  );
}

createRoot(root).render(
  <AppRoot>
    {firebaseConfigError ? <MissingFirebaseConfigScreen /> : <App />}
    <Toaster position="top-right" richColors />
  </AppRoot>,
);
