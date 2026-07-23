import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
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
        // Entry points das edge functions (Deno) são orquestração de IO
        // (fetch/DB/auth) — a convenção deste projeto é testar só a lógica
        // pura extraída para _shared/** (que os testes "edge" cobrem).
        // Contá-los no threshold de cobertura de unidade mede a métrica
        // errada: index.ts nunca teve, nem deveria ter, teste unitário.
        "supabase/functions/*/index.ts",
        "supabase/functions/_shared/__tests__/**",
      ],
    },
    projects: [
      {
        plugins: [react()],
        resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
        test: {
          name: "app",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
        test: {
          name: "edge",
          environment: "node",
          globals: true,
          include: ["supabase/functions/**/__tests__/**/*.test.ts"],
          // Testes Deno-nativos (Deno.test + imports https://deno.land/...)
          // não são executáveis pelo vitest/Node — devem rodar via
          // `supabase--test_edge_functions` (deno test). Excluir aqui evita
          // suites em vermelho no CI de unidade sem esconder os testes.
          exclude: [
            "**/gmaps-mapper.test.ts",
            "**/hiker-normalize.test.ts",
            "**/hiker-normalize-extra.test.ts",
            "**/instagram-config-hash.test.ts",
          ],
        },
      },
    ],
  },
});
