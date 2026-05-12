import { db } from "@/integrations/supabase/withOrg";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface PontoMirrorEntry {
  data: string;
  registros: any[];
  totalHoras: string;
  observacoes: string[];
}

export const pontosService = {
  getEspelhoPonto: async (userId: string, month: Date) => {
    const start = startOfMonth(month).toISOString();
    const end = endOfMonth(month).toISOString();

    const { data: registros, error: regError } = await db
      .from("ponto_registros" as any)
      .select("*")
      .eq("user_id", userId)
      .gte("timestamp", start)
      .lte("timestamp", end)
      .order("timestamp", { ascending: true });

    if (regError) throw regError;

    const { data: ajustes, error: ajError } = await db
      .from("ponto_ajustes" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("status", "aprovado")
      .gte("data_nova", start)
      .lte("data_nova", end);

    if (ajError) throw ajError;

    // Lógica básica de agrupamento por dia e cálculo (simplificada para o exemplo)
    // Em uma implementação real, isso seria mais complexo considerando turnos
    const mirror: Record<string, PontoMirrorEntry> = {};

    registros.forEach((r: any) => {
      const dateKey = format(new Date(r.timestamp), "yyyy-MM-dd");
      if (!mirror[dateKey]) {
        mirror[dateKey] = { data: dateKey, registros: [], totalHoras: "0", observacoes: [] };
      }
      mirror[dateKey].registros.push(r);
    });

    return Object.values(mirror);
  },

  exportarPDF: async (userId: string, month: Date) => {
    // Placeholder para exportação
    console.log("Exportando PDF para", userId, format(month, "MM/yyyy"));
    return { success: true, url: "#" };
  }
};
