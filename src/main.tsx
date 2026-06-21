import { Fragment, StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initErrorTracking } from './lib/errorHandler';
import { applyTheme, getInitialTheme } from './lib/theme';
import { Toaster } from 'sonner';

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

createRoot(document.getElementById('root')!).render(
  <AppRoot>
    <App />
    <Toaster position="top-right" richColors />
  </AppRoot>,
);
