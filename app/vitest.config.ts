import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Khớp alias "@/..." trong tsconfig để test import giống app.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: { environment: "node", setupFiles: ["./vitest.setup.ts"] },
});
