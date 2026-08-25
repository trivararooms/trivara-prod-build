import { defineConfig } from "vitest/config";
import path from "path";

// Separate from vite.config.ts (which also loads the lovable-tagger dev
// plugin and Vercel-specific settings) so `npm test` stays fast and doesn't
// need those dev-only dependencies.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
