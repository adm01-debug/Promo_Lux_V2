import type { DashboardStats, RecentCompany } from "@/hooks/useDashboardData";

/* ── Dashboard Stats ── */
export const DEMO_STATS: DashboardStats = {
  activeWorkflows: 7,
  runningWorkflows: 3,
  totalCompanies: 1_284,
  enrichedCompanies: 847,
  totalCompaniesCount: 1_284,
  avgIpcScore: 72,
  todayScrapeJobs: 12,
  totalScrapeJobs: 48,
  completedScrapeJobs: 41,
};

/* ── Weekly Performance Chart ── */
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getRecentDayLabels(): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    labels.push(DAY_LABELS[d.getDay()]);
  }
  return labels;
}

export const DEMO_PERFORMANCE = (() => {
  const labels = getRecentDayLabels();
  const raspadas = [42, 58, 35, 71, 93, 64, 87];
  const qualificadas = [18, 26, 14, 38, 52, 31, 49];
  return labels.map((day, i) => ({
    day,
    raspadas: raspadas[i],
    qualificadas: qualificadas[i],
  }));
})();

/* ── Recent Companies ── */
export const DEMO_COMPANIES: RecentCompany[] = [
  { id: "d1", name: "TechNova Solutions", sector: "Tecnologia", location: "São Paulo, SP", ipc_score: 92, source: "gmaps", website: "https://technova.com.br", enriched: true },
  { id: "d2", name: "Construtora Horizonte", sector: "Construção", location: "Curitiba, PR", ipc_score: 85, source: "gmaps", website: "https://horizonte.eng.br", enriched: true },
  { id: "d3", name: "Grupo Saúde Mais", sector: "Saúde", location: "Rio de Janeiro, RJ", ipc_score: 78, source: "linkedin", website: null, enriched: true },
  { id: "d4", name: "AgroTech Brasil", sector: "Agronegócio", location: "Ribeirão Preto, SP", ipc_score: 71, source: "gmaps", website: "https://agrotech.agr.br", enriched: false },
  { id: "d5", name: "Fintech Capital", sector: "Financeiro", location: "Belo Horizonte, MG", ipc_score: 88, source: "manual", website: "https://fintechcapital.com.br", enriched: true },
  { id: "d6", name: "EduStart Learning", sector: "Educação", location: "Florianópolis, SC", ipc_score: 65, source: "gmaps", website: null, enriched: false },
];

/* ── Activity Feed (notifications) ── */
function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString();
}

export const DEMO_ACTIVITY = [
  { id: "n1", type: "success", title: "Lead quente detectado", message: 'TechNova Solutions atingiu score IPC 92 — pronta para abordagem.', created_at: minutesAgo(3), read: false, metadata: {} },
  { id: "n2", type: "enrichment", title: "Empresa enriquecida", message: 'Construtora Horizonte foi enriquecida com dados de 12 fontes.', created_at: minutesAgo(12), read: false, metadata: {} },
  { id: "n3", type: "system", title: "Workflow concluído", message: 'O workflow "Prospecção SP Capital" processou 87 empresas com sucesso.', created_at: minutesAgo(28), read: false, metadata: {} },
  { id: "n4", type: "success", title: "Score IPC atualizado", message: 'Fintech Capital subiu de 74 para 88 após enriquecimento de dados.', created_at: minutesAgo(45), read: true, metadata: {} },
  { id: "n5", type: "enrichment", title: "Lote enriquecido", message: '34 empresas do lote "Saúde RJ" foram enriquecidas automaticamente.', created_at: minutesAgo(90), read: true, metadata: {} },
  { id: "n6", type: "error", title: "Raspagem falhou", message: 'A raspagem "Restaurantes Zona Sul" falhou por timeout. Tente novamente.', created_at: minutesAgo(120), read: true, metadata: {} },
  { id: "n7", type: "system", title: "Novo sinal de intenção", message: 'Grupo Saúde Mais visitou a página de preços 3x nas últimas 24h.', created_at: minutesAgo(180), read: true, metadata: {} },
  { id: "n8", type: "success", title: "Campanha enviada", message: 'Campanha "Outbound Tech Q1" enviou 156 e-mails com taxa de abertura de 34%.', created_at: minutesAgo(240), read: true, metadata: {} },
];

/* ── Workflows ── */
export const DEMO_WORKFLOWS = [
  { id: "w1", name: "Prospecção SP Capital", status: "running", success_rate: 78, last_run_at: minutesAgo(5), leads_processed: 342, leads_qualified: 89, description: "Pipeline automático São Paulo", config: {}, steps: [], created_at: minutesAgo(10000), updated_at: minutesAgo(5), user_id: "demo" },
  { id: "w2", name: "Enriquecimento Saúde", status: "active", success_rate: 92, last_run_at: minutesAgo(28), leads_processed: 156, leads_qualified: 67, description: "Enriquecer leads do setor saúde", config: {}, steps: [], created_at: minutesAgo(20000), updated_at: minutesAgo(28), user_id: "demo" },
  { id: "w3", name: "Scraping Curitiba", status: "completed", success_rate: 65, last_run_at: minutesAgo(120), leads_processed: 89, leads_qualified: 23, description: "Raspagem região Curitiba", config: {}, steps: [], created_at: minutesAgo(30000), updated_at: minutesAgo(120), user_id: "demo" },
  { id: "w4", name: "Qualificação IPC Alto", status: "paused", success_rate: 45, last_run_at: minutesAgo(360), leads_processed: 210, leads_qualified: 54, description: "Filtrar IPC acima de 75", config: {}, steps: [], created_at: minutesAgo(40000), updated_at: minutesAgo(360), user_id: "demo" },
  { id: "w5", name: "Outbound Fintech", status: "draft", success_rate: 0, last_run_at: null, leads_processed: 0, leads_qualified: 0, description: "Campanha fintechs BH", config: {}, steps: [], created_at: minutesAgo(50000), updated_at: minutesAgo(1000), user_id: "demo" },
];

/* ── Enrichment Funnel ── */
export const DEMO_FUNNEL = {
  total: 1284,
  enriched: 847,
  highScore: 412,
  qualified: 198,
};
