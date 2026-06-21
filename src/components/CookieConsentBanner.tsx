import React, { useState } from "react";
import { Cookie, Settings2 } from "lucide-react";
import {
  createCookieConsentPreferences,
  type CookieConsentPreferences,
} from "../lib/cookieConsent";

export function CookieConsentBanner({
  onSave,
}: {
  onSave: (preferences: CookieConsentPreferences) => void;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [performanceCache, setPerformanceCache] = useState(true);
  const [preferenceStorage, setPreferenceStorage] = useState(true);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-4">
      <div className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-slate-700/80 bg-slate-950/96 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Cookie className="h-4 w-4 text-cyan-300" />
                We use cookies
              </div>
              <p className="text-sm leading-6 text-slate-400">
                We use essential cookies and similar browser storage to keep the
                site secure and working properly. With your permission, we also
                use optional storage for faster repeat lookups and to remember
                non-essential preferences.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Essential storage is always active.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setShowOptions((current) => !current)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500/80 hover:text-white"
              >
                <Settings2 className="h-4 w-4" />
                {showOptions ? "Hide settings" : "Cookie settings"}
              </button>
              <button
                type="button"
                onClick={() =>
                  onSave(
                    createCookieConsentPreferences({
                      performanceCache: false,
                      preferenceStorage: false,
                    }),
                  )
                }
                className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500/80 hover:text-white"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() =>
                  onSave(
                    createCookieConsentPreferences({
                      performanceCache: true,
                      preferenceStorage: true,
                    }),
                  )
                }
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-cyan-300"
              >
                Accept all
              </button>
            </div>
          </div>

          {showOptions && (
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-100">
                  Manage cookie preferences
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Choose which optional storage features you want to allow.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <label className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        Essential
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Required for authentication, security, and core app
                        functionality.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400 opacity-70"
                    />
                  </div>
                </label>

                <label className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        Performance
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Stores app, ranking, and search responses locally so
                        repeated checks load faster.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={performanceCache}
                      onChange={(event) =>
                        setPerformanceCache(event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-cyan-500"
                    />
                  </div>
                </label>

                <label className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        Preferences
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Remembers non-essential choices like dismissed onboarding
                        panels.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferenceStorage}
                      onChange={(event) =>
                        setPreferenceStorage(event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-cyan-500"
                    />
                  </div>
                </label>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    onSave(
                      createCookieConsentPreferences({
                        performanceCache: false,
                        preferenceStorage: false,
                      }),
                    )
                  }
                  className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500/80 hover:text-white"
                >
                  Reject all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSave(
                      createCookieConsentPreferences({
                        performanceCache,
                        preferenceStorage,
                      }),
                    )
                  }
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-cyan-300"
                >
                  Save preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
