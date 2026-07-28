import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: "render_com",
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
