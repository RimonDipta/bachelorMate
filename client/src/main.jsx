import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { RealtimeProvider } from "./context/RealtimeContext";
import { I18nProvider } from "./i18n/I18nProvider";
import App from "./App";
import { installGlobalErrorHandlers } from "./lib/errorReporting";
import { registerServiceWorker } from "./lib/pwa";
import "./styles/app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: true,
      // Retry server errors and dropped connections, not 4xx answers.
      retry: (count, err) => (err?.status >= 500 || err?.status === 0) && count < 2,
    },
  },
});

installGlobalErrorHandlers();
registerServiceWorker();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <I18nProvider>
              <ThemeProvider>
                <RealtimeProvider>
                  <App />
                </RealtimeProvider>
              </ThemeProvider>
            </I18nProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
