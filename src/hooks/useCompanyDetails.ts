import { useQuery } from "@tanstack/react-query";
import { db, getActiveOrgId } from "@/integrations/supabase/withOrg";

export interface CompanyStakeholder {
  id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  confidence_score: number | null;
}

export interface CompanySignal {
  id: string;
  type: string;
  signal: string;
  strength: string | null;
  details: string | null;
  created_at: string;
}

export interface CompanyTimelineEntry {
  id: string;
  action: string;
  type: string;
  date: string;
  detail: string;
}

export interface CompanyDetails {
  contacts: CompanyStakeholder[];
  signals: CompanySignal[];
  timeline: CompanyTimelineEntry[];
  technologies: string[];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Busca dados reais da empresa (contatos, sinais, timeline e tech stack)
 * escopados pela organização ativa. Substitui os mocks do modal de detalhes.
 */
export function useCompanyDetails(companyId: string | null | undefined, enabled: boolean) {
  const orgId = getActiveOrgId();

  return useQuery<CompanyDetails>({
    queryKey: ["company-details", companyId, orgId],
    enabled: !!companyId && !!orgId && enabled,
    queryFn: async () => {
      const [contactsRes, signalsRes, companyRes] = await Promise.all([
        db
          .from("stakeholders")
          .select("id, full_name, role, email, linkedin_url, confidence_score")
          .eq("company_id", companyId!)
          .order("confidence_score", { ascending: false, nullsFirst: false }),
        db
          .from("intent_signals")
          .select("id, type, signal, strength, details, created_at")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false }),
        db
          .from("companies")
          .select("raw_data, created_at, enriched")
          .eq("id", companyId!)
          .maybeSingle(),
      ]);

      if (contactsRes.error) throw contactsRes.error;
      if (signalsRes.error) throw signalsRes.error;

      const contacts = (contactsRes.data ?? []) as CompanyStakeholder[];
      const signals = (signalsRes.data ?? []) as CompanySignal[];

      // Timeline derivada de eventos reais: criação, enriquecimento e sinais.
      const timeline: CompanyTimelineEntry[] = [];
      const rawData = (companyRes.data?.raw_data ?? {}) as Record<string, unknown>;

      for (const s of signals) {
        timeline.push({
          id: `signal-${s.id}`,
          action: s.signal,
          type: "signal",
          date: fmtDate(s.created_at),
          detail: s.details ?? s.type,
        });
      }

      if (companyRes.data?.enriched) {
        timeline.push({
          id: "enrichment",
          action: "Empresa enriquecida",
          type: "enrichment",
          date: contacts.length ? "—" : "—",
          detail: `${contacts.length} contato(s) encontrado(s)`,
        });
      }

      if (companyRes.data?.created_at) {
        timeline.push({
          id: "created",
          action: "Empresa adicionada",
          type: "discovery",
          date: fmtDate(companyRes.data.created_at),
          detail: "Registro criado no LUX IA",
        });
      }

      // Tech stack via raw_data.technologies quando disponível.
      const rawTech = rawData["technologies"];
      const technologies = Array.isArray(rawTech)
        ? (rawTech.filter((t) => typeof t === "string") as string[])
        : [];

      return { contacts, signals, timeline, technologies };
    },
  });
}
