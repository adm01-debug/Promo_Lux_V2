import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // `true` (não o literal "::") — expõe em 0.0.0.0/:: quando disponível,
    // mas não EXIGE IPv6: um "::" hardcoded falha com EAFNOSUPPORT em
    // qualquer sandbox/container sem stack IPv6 (inclusive o webServer que
    // o playwright.config.ts sobe sozinho para os testes e2e).
    host: true,
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router-dom)/.test(id)) return "vendor-react";
          if (/node_modules\/(@radix-ui\/react-dialog|@radix-ui\/react-popover|@radix-ui\/react-tooltip|@radix-ui\/react-tabs|@radix-ui\/react-select|@radix-ui\/react-dropdown-menu)/.test(id)) return "vendor-ui";
          if (/node_modules\/@tanstack\/react-query/.test(id)) return "vendor-query";
          if (/node_modules\/framer-motion/.test(id)) return "vendor-motion";
          if (/node_modules\/@supabase\/supabase-js/.test(id)) return "vendor-supabase";
          if (/node_modules\/recharts/.test(id)) return "vendor-charts";
          if (/node_modules\/(leaflet|react-leaflet)/.test(id)) return "vendor-map";
        },
      },
    },
  },
}));
