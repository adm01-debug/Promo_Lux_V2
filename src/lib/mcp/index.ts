import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCompaniesTool from "./tools/list-companies";
import getCompanyTool from "./tools/get-company";
import listScrapeJobsTool from "./tools/list-scrape-jobs";
import getDashboardStatsTool from "./tools/get-dashboard-stats";
import listDecisionMakersTool from "./tools/list-decision-makers";

/**
 * O issuer OAuth PRECISA ser o host direto do Supabase — construído a partir
 * do project ref, nunca de SUPABASE_URL (que em Lovable Cloud é o proxy
 * `.lovable.cloud` e faria a verificação do token falhar por divergência de
 * issuer, RFC 8414 §3.3). `import.meta.env` é inlined pelo Vite em build time,
 * mantendo este módulo import-safe (sem leitura de env em runtime).
 */
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lux-ia-mcp",
  title: "LUX IA",
  version: "1.0.0",
  instructions:
    "Ferramentas de prospecção e inteligência de vendas do LUX IA. Use `list_companies` e `get_company` para consultar a base de empresas, `list_decision_makers` para contatos decisores enriquecidos, `list_scrape_jobs` para acompanhar raspagens e `get_dashboard_stats` para métricas consolidadas. Todas as leituras respeitam o isolamento por organização do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCompaniesTool,
    getCompanyTool,
    listDecisionMakersTool,
    listScrapeJobsTool,
    getDashboardStatsTool,
  ],
});
