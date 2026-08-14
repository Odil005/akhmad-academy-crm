import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  nitro: {
    // Vercel serverless functions and routing.
    preset: "vercel",
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },

  // The MCP route generator currently resolves Windows paths incorrectly.
  // It is not needed for the CRM UI, so keep local Windows development fast and reliable.
  plugins: process.platform === "win32" ? [] : [mcpPlugin()],
});
