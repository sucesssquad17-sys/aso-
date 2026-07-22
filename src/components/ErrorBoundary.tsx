import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { safeStorage } from "../lib/storage";
import { CacheService } from "../lib/cache";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Log to Sentry if initialized
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setContext("react", { componentStack: errorInfo.componentStack?.slice(0, 4_000) });
        Sentry.captureException(error);
      });
    }
  }

  private handleReset = () => {
    try {
      CacheService.clearAll();
      ["aso-selected-view", "aso-last-route"].forEach((key) => safeStorage.removeItem(key));
    } catch (e) {
      console.error('Failed to clear localStorage', e);
    }
    this.setState({ hasError: false, error: null });
    try {
      window.location.reload();
    } catch (e) {
      window.location.href = window.location.href;
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
            <p className="text-zinc-600 mb-8">
              An unexpected error occurred. Reload the workspace to try again.
            </p>
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-zinc-200/20"
              >
                <RefreshCw className="w-5 h-5" />
                Reload Application
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full text-zinc-500 hover:text-zinc-700 font-medium py-2"
              >
                Try to continue
              </button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-8 p-4 bg-zinc-50 rounded-lg text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-red-600 whitespace-pre-wrap">
                  {this.state.error.stack}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
