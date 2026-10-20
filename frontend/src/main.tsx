import React from "react";
import ReactDOM from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { App } from "./App";
import { persistOptions, queryClient } from "./queryClient";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
