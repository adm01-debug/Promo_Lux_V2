import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "supabase/functions/**/__tests__/**/*.test.ts",
    ],
    // Edge functions rodam em Deno/Node — não precisam de jsdom.
    // Mantém jsdom como default para src/** e força node só onde faz sentido.
    environmentMatchGlobs: [
      ["supabase/functions/**", "node"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
      exclude: [
        "node_modules/**",
        "src/test/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "src/integrations/supabase/types.ts",
        "src/integrations/supabase/client.ts",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
