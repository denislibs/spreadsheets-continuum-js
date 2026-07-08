/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages project site: set by the deploy workflow only
  base: process.env.DEPLOY_BASE ?? "/",
  test: {
    environment: "jsdom",
  },
});
