import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Deploy target is chosen at build time so the same codebase runs on Vercel,
// Cloudflare Workers, Render/Node and a plain local server.
//   Vercel      -> NITRO_PRESET=vercel        (default)
//   Cloudflare  -> NITRO_PRESET=cloudflare_module
//   Render/VPS  -> NITRO_PRESET=node_server   (then: node .output/server/index.mjs)
//   Local test  -> NITRO_PRESET=node_server   (bun run build && bun run start)
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
