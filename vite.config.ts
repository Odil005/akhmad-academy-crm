import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

const publicBackendUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://bsuvywszdkqaetbyrfqk.supabase.co";
const publicBackendKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdXZ5d3N6ZGtxYWV0YnlyZnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MzcxNzgsImV4cCI6MjEwMDAxMzE3OH0.Bo-aXzNniUAdh24ProFFcpXxlrik-7Od0Q0tW23TTC0";

// Deploy target is chosen at build time so the same codebase runs on Vercel,
// Cloudflare Workers, Render/Node and a plain local server.
//   Vercel      -> default (no NITRO_PRESET)
//   Cloudflare  -> bun run build:cloudflare  (NITRO_PRESET=cloudflare-module)
//   Render/VPS  -> bun run build:node        (NITRO_PRESET=node-server) + bun run start
// Inside the Lovable build environment NITRO_PRESET is ignored on purpose:
// preview/publish always build the Cloudflare worker.
const preset = process.env.NITRO_PRESET?.trim() || "vercel";

export default defineConfig({
  // External builders do not receive Lovable's VITE_* injection automatically.
  // These are public browser credentials (database access remains protected by RLS),
  // and defining them here prevents production hydration/auth from crashing.
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicBackendUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicBackendKey),
    },
  },

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
