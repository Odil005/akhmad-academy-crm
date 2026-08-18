import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Deploy target is chosen at build time so the same codebase runs on Vercel,
// Cloudflare Workers, Render/Node and a plain local server.
//   Vercel      -> default (no NITRO_PRESET)
//   Cloudflare  -> bun run build:cloudflare  (NITRO_PRESET=cloudflare-module)
//   Render/VPS  -> bun run build:node        (NITRO_PRESET=node-server) + bun run start
// Inside the Lovable build environment NITRO_PRESET is ignored on purpose:
// preview/publish always build the Cloudflare worker.
const preset = process.env.NITRO_PRESET?.trim() || "vercel";

export default defineConfig({
  nitro: {
    preset,
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
