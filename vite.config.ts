import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  nitro: {
    preset: "netlify",
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },

  plugins: [mcpPlugin()],
});
