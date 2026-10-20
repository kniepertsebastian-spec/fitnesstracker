import React from "react";
import ReactDOM from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { App } from "./App";
import { persistOptions, queryClient } from "./queryClient";
import "./styles/index.css";

// A lazy chunk that can't be fetched usually means a newer build replaced the one this page was
// loaded from (its hashed files are gone). Reload once to pick up the new build; the guard keeps
// a genuine outage from turning into a reload loop (the error boundary takes over then).
window.addEventListener("vite:preloadError", (event) => {
  const key = "fitnesstracker.chunk-reload-at";
  try {
    if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) < 30_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
