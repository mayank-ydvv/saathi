/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Port 5174 is the parent app's slot in the backend's CORS list (contract 4.6).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    env: { VITE_USE_MOCK: "false", VITE_API_BASE: "http://api.test", VITE_HOME_ID: "home-demo-1" },
  },
});
