import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ORG_SCOPED_TABLES } from "../withOrg";

/**
 * GUARDA DE ESCOPO DAS TELAS DO PAINEL.
 *
 * Estas telas liam tabelas multi-tenant direto pelo client (`supabase.from`):
 * sem `organization_id` (dado de outra org visivel no painel) e, nas tabelas com
 * exclusao reversivel, sem o filtro de lixeira. Passaram a usar o wrapper `db`.
 *
 * O teste trava a regressao lendo o proprio fonte: se alguem voltar a ler a
 * mesma tabela pelo client cru, a leitura deixa de ser escopada e falha aqui.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface TelaEscopada {
  arquivo: string;
  tabela: string;
  /** `write` cobre hooks que só gravam (update/delete) a tabela. */
  op?: "select" | "write";
}

const TELAS: TelaEscopada[] = [
  { arquivo: "components/lux/CompaniesMapView.tsx", tabela: "companies" },
  { arquivo: "components/lux/CompanyDetailModal.tsx", tabela: "companies" },
  { arquivo: "components/lux/CampaignsView.tsx", tabela: "campaigns" },
  {
    arquivo: "components/lux/campaigns/CampaignTrackingDrawer.tsx",
    tabela: "campaigns",
  },
  { arquivo: "components/lux/AutomationsList.tsx", tabela: "workflows" },
  { arquivo: "hooks/useWeeklyPerformance.ts", tabela: "companies" },
  { arquivo: "hooks/useEmailTemplates.ts", tabela: "email_templates" },
  { arquivo: "hooks/useApiKeys.ts", tabela: "api_keys" },
  { arquivo: "hooks/useTaskReminders.ts", tabela: "deal_tasks" },
  { arquivo: "hooks/useSatisfaction.ts", tabela: "satisfaction_surveys", op: "write" },
  { arquivo: "hooks/useSalesGoals.ts", tabela: "sales_goals", op: "write" },
];

/** Fonte sem quebras de linha: a cadeia de metodos pode estar quebrada. */
function fontePlana(arquivo: string): string {
  const caminho = join(RAIZ, arquivo);
  return readFileSync(caminho, "utf8").replace(/\s+/g, " ");
}

describe("telas do painel consultam tabelas multi-tenant pelo wrapper", () => {
  for (const { arquivo, tabela, op = "select" } of TELAS) {
    it(`${arquivo} ${op === "write" ? "grava" : "le"} ${tabela} com escopo`, () => {
      expect(ORG_SCOPED_TABLES.has(tabela)).toBe(true);

      const fonte = fontePlana(arquivo);
      const chamada = (alvo: "db" | "supabase", metodo: string) =>
        new RegExp(`${alvo}\\s*\\.from\\("${tabela}"\\)\\s*\\.${metodo}\\(`).test(fonte);
      if (op === "write") {
        expect(chamada("db", "update") || chamada("db", "delete")).toBe(true);
        expect(chamada("supabase", "update") || chamada("supabase", "delete")).toBe(false);
      } else {
        expect(chamada("db", "select")).toBe(true);
        expect(chamada("supabase", "select")).toBe(false);
      }
    });
  }
});
