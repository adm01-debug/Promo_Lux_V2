import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/integrations/supabase/withOrg";

/** jsPDF instance after jspdf-autotable attaches `lastAutoTable`. */
type AutoTableDoc = jsPDF & { lastAutoTable: { finalY: number } };

export async function exportAnalyticsPDF() {
  // Gather data
  const [
    { data: companies },
    { data: scrapeJobs },
    { data: workflows },
    { data: campaigns },
  ] = await Promise.all([
    db.from("companies").select("sector, ipc_score, enriched, source, created_at"),
    db.from("scrape_jobs").select("status, results_count"),
    db.from("workflows").select("status, leads_processed, leads_qualified, success_rate"),
    db.from("campaigns").select("name, prospects, sent, opened, replied, meetings"),
  ]);

  const doc = new jsPDF();
  const gold: [number, number, number] = [212, 165, 32]; // #D4A520
  const dark: [number, number, number] = [10, 13, 20]; // Background color

  const totalCompanies = companies?.length ?? 0;
  const enrichedCount = (companies ?? []).filter((c) => c.enriched).length;
  const scores = (companies ?? []).map((c) => c.ipc_score ?? 0).filter((s) => s > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const completedJobs = (scrapeJobs ?? []).filter((j) => j.status === "completed").length;
  const totalLeads = (workflows ?? []).reduce((a, w) => a + (w.leads_processed ?? 0), 0);

  const allCampaigns = campaigns ?? [];
  const totalProspects = allCampaigns.reduce((a, c) => a + (c.prospects || 0), 0);
  const totalMeetings = allCampaigns.reduce((a, c) => a + (c.meetings || 0), 0);

  // Header
  doc.setFillColor(dark[0], dark[1], dark[2]);
  doc.rect(0, 0, 210, 40, "F");
  
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.setFontSize(24);
  doc.text("LUX IA", 15, 20);
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Relatório Executivo de Analytics", 15, 30);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 150, 25);

  // Summary Grid
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text("Resumo Geral", 15, 55);
  
  autoTable(doc, {
    startY: 60,
    head: [["Métrica", "Valor", "Status"]],
    body: [
      ["Total de Empresas", totalCompanies.toString(), "Ok"],
      ["Enriquecidas", `${enrichedCount} (${totalCompanies > 0 ? Math.round((enrichedCount / totalCompanies) * 100) : 0}%)`, enrichedCount > 0 ? "Ativo" : "Pendente"],
      ["Score IPC Médio", avgScore.toString(), avgScore > 70 ? "Excelente" : "Bom"],
      ["Raspagens Concluídas", `${completedJobs}/${scrapeJobs?.length ?? 0}`, "Ok"],
      ["Leads Processados", totalLeads.toString(), "Ok"],
    ],
    headStyles: { fillColor: gold, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  // Funnel Data
  const funnelY = (doc as AutoTableDoc).lastAutoTable.finalY + 15;
  doc.text("Funil de Conversão", 15, funnelY);
  
  const totalSent = allCampaigns.reduce((a, c) => a + (c.sent || 0), 0);
  const totalOpened = allCampaigns.reduce((a, c) => a + (c.opened || 0), 0);
  const totalReplied = allCampaigns.reduce((a, c) => a + (c.replied || 0), 0);

  autoTable(doc, {
    startY: funnelY + 5,
    head: [["Etapa", "Volume", "Taxa %"]],
    body: [
      ["Prospects", totalProspects.toString(), "100%"],
      ["Enviados", totalSent.toString(), totalProspects > 0 ? `${Math.round((totalSent / totalProspects) * 100)}%` : "0%"],
      ["Abertos", totalOpened.toString(), totalSent > 0 ? `${Math.round((totalOpened / totalSent) * 100)}%` : "0%"],
      ["Respondidos", totalReplied.toString(), totalSent > 0 ? `${Math.round((totalReplied / totalSent) * 100)}%` : "0%"],
      ["Reuniões", totalMeetings.toString(), totalProspects > 0 ? `${((totalMeetings / totalProspects) * 100).toFixed(1)}%` : "0%"],
    ],
    headStyles: { fillColor: gold, textColor: [255, 255, 255] },
  });

  // Sector distribution
  const sectorMap = new Map<string, number>();
  (companies ?? []).forEach((c) => {
    const s = c.sector ?? "Outros";
    sectorMap.set(s, (sectorMap.get(s) || 0) + 1);
  });
  
  const sectorY = (doc as AutoTableDoc).lastAutoTable.finalY + 15;
  doc.text("Distribuição por Setor", 15, sectorY);
  
  autoTable(doc, {
    startY: sectorY + 5,
    head: [["Setor", "Quantidade", "Percentual %"]],
    body: Array.from(sectorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sector, count]) => [
        sector,
        count.toString(),
        `${Math.round((count / totalCompanies) * 100)}%`
      ]),
    headStyles: { fillColor: gold, textColor: [255, 255, 255] },
  });

  // Campaign Detail
  if (allCampaigns.length > 0) {
    doc.addPage();
    doc.setFillColor(dark[0], dark[1], dark[2]);
    doc.rect(0, 0, 210, 20, "F");
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.setFontSize(14);
    doc.text("Detalhe por Campanha", 15, 13);
    
    autoTable(doc, {
      startY: 25,
      head: [["Nome", "Prospects", "Abertura %", "Resposta %", "Reuniões"]],
      body: allCampaigns.map((c) => [
        c.name,
        c.prospects.toString(),
        c.sent > 0 ? `${Math.round((c.opened / c.sent) * 100)}%` : "0%",
        c.sent > 0 ? `${Math.round((c.replied / c.sent) * 100)}%` : "0%",
        c.meetings.toString()
      ]),
      headStyles: { fillColor: gold, textColor: [255, 255, 255] },
    });
  }

  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`LUX IA Sales Intelligence Platform - Página ${i} de ${pageCount}`, 105, 290, { align: "center" });
  }

  doc.save(`lux-ia-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
}
