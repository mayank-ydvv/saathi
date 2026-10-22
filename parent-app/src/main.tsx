import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHttpApi, createMockApi } from "./api";
import { App } from "./App";
import { config, MOCK_NUDGE_AFTER_MS } from "./config";
import "./index.css";

const api = config.useMock
  ? createMockApi(MOCK_NUDGE_AFTER_MS)
  : createHttpApi(config.apiBase, config.homeId);

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

createRoot(root).render(
  <StrictMode>
    <App api={api} />
  </StrictMode>,
);
