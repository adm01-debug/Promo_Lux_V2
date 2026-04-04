import { supabase } from "@/integrations/supabase/client";

export async function exportAnalyticsPDF() {
  // Gather data
  const [
    { data: companies },
    { data: scrapeJobs },
    { data: workflows },
    { data: campaigns },
  ] = await Promise.all([
    supabase.from("companies").select("sector, ipc_score, enriched, source"),
    supabase.from("scrape_jobs").select("status, results_count"),
    supabase.from("workflows").select("leads_processed, leads_qualified, success_rate"),
    supabase.from("campaigns").select("name, prospects, sent, opened, replied, meetings"),
  ]);

  const totalCompanies = companies?.length ?? 0;
  const enrichedCount = (companies ?? []).filter((c) => c.enriched).length;
  const scores = (companies ?? []).map((c) => c.ipc_score ?? 0).filter((s) => s > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const completedJobs = (scrapeJobs ?? []).filter((j) => j.status === "completed").length;
  const totalLeads = (workflows ?? []).reduce((a, w) => a + (w.leads_processed ?? 0), 0);

  const allCampaigns = campaigns ?? [];
  const totalProspects = allCampaigns.reduce((a, c) => a + (c.prospects || 0), 0);
  const totalMeetings = allCampaigns.reduce((a, c) => a + (c.meetings || 0), 0);

  // Sector distribution
  const sectorMap = new Map<string, number>();
  (companies ?? []).forEach((c) => {
    const s = c.sector ?? "Outros";
    sectorMap.set(s, (sectorMap.get(s) || 0) + 1);
  });

  // Build text-based PDF using a simple approach
  const now = new Date().toLocaleString("pt-BR");
  
  let content = `LUX IA — Relatório de Analytics\nGerado em: ${now}\n\n`;
  content += `═══════════════════════════════════════════\n`;
  content += `RESUMO GERAL\n`;
  content += `═══════════════════════════════════════════\n`;
  content += `Total de Empresas: ${totalCompanies}\n`;
  content += `Enriquecidas: ${enrichedCount} (${totalCompanies > 0 ? Math.round((enrichedCount / totalCompanies) * 100) : 0}%)\n`;
  content += `Score IPC Médio: ${avgScore}\n`;
  content += `Raspagens Concluídas: ${completedJobs}/${scrapeJobs?.length ?? 0}\n`;
  content += `Total Leads Processados: ${totalLeads}\n\n`;

  content += `═══════════════════════════════════════════\n`;
  content += `DISTRIBUIÇÃO POR SETOR\n`;
  content += `═══════════════════════════════════════════\n`;
  Array.from(sectorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([sector, count]) => {
      const pct = Math.round((count / totalCompanies) * 100);
      content += `  ${sector}: ${count} (${pct}%)\n`;
    });

  content += `\n═══════════════════════════════════════════\n`;
  content += `FUNIL DE CONVERSÃO\n`;
  content += `═══════════════════════════════════════════\n`;
  content += `Prospects: ${totalProspects}\n`;
  content += `Enviados: ${allCampaigns.reduce((a, c) => a + (c.sent || 0), 0)}\n`;
  content += `Abertos: ${allCampaigns.reduce((a, c) => a + (c.opened || 0), 0)}\n`;
  content += `Respondidos: ${allCampaigns.reduce((a, c) => a + (c.replied || 0), 0)}\n`;
  content += `Reuniões: ${totalMeetings}\n`;
  content += `Taxa Conv.: ${totalProspects > 0 ? ((totalMeetings / totalProspects) * 100).toFixed(1) : "0"}%\n\n`;

  if (allCampaigns.length > 0) {
    content += `═══════════════════════════════════════════\n`;
    content += `CAMPANHAS\n`;
    content += `═══════════════════════════════════════════\n`;
    allCampaigns.forEach((c) => {
      const openRate = c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0;
      const replyRate = c.sent > 0 ? Math.round((c.replied / c.sent) * 100) : 0;
      content += `  ${c.name}\n`;
      content += `    Prospects: ${c.prospects} | Enviados: ${c.sent} | Abertura: ${openRate}% | Resposta: ${replyRate}% | Reuniões: ${c.meetings}\n`;
    });
  }

  // Download as text file (styled as report)
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lux-ia-analytics-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
