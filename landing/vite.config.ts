/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 5173 is the dashboard and 5174 the parent app; the landing page is static and calls no API.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
