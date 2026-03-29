import { BarChart3, TrendingUp, Building2, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

const dailyData = [
  { day: "Seg", empresas: 45, qualificadas: 32 },
  { day: "Ter", empresas: 62, qualificadas: 48 },
  { day: "Qua", empresas: 78, qualificadas: 55 },
  { day: "Qui", empresas: 51, qualificadas: 38 },
  { day: "Sex", empresas: 95, qualificadas: 72 },
  { day: "Sáb", empresas: 30, qualificadas: 22 },
  { day: "Dom", empresas: 15, qualificadas: 10 },
];

const conversionData = [
  { week: "S1", raspadas: 320, enriquecidas: 240, qualificadas: 180, contatadas: 90, reunioes: 15 },
  { week: "S2", raspadas: 410, enriquecidas: 310, qualificadas: 220, contatadas: 120, reunioes: 22 },
  { week: "S3", raspadas: 380, enriquecidas: 290, qualificadas: 200, contatadas: 110, reunioes: 18 },
  { week: "S4", raspadas: 520, enriquecidas: 400, qualificadas: 310, contatadas: 160, reunioes: 30 },
];

const sectorData = [
  { name: "SaaS B2B", value: 35, color: "hsl(45, 100%, 58%)" },
  { name: "Fintech", value: 22, color: "hsl(142, 71%, 45%)" },
  { name: "HealthTech", value: 15, color: "hsl(210, 80%, 60%)" },
  { name: "E-commerce", value: 12, color: "hsl(280, 70%, 55%)" },
  { name: "EdTech", value: 8, color: "hsl(340, 70%, 55%)" },
  { name: "Outros", value: 8, color: "hsl(215, 12%, 50%)" },
];

const ipcTrend = [
  { month: "Jan", score: 68 },
  { month: "Fev", score: 71 },
  { month: "Mar", score: 73 },
  { month: "Abr", score: 70 },
  { month: "Mai", score: 76 },
  { month: "Jun", score: 79 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass rounded-lg p-2.5 border border-border/50 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export const AnalyticsView = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics & Relatórios
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas de desempenho de raspagem, enriquecimento e conversão
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily companies */}
        <div className="glass rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Empresas por Dia</h3>
          <p className="text-xs text-muted-foreground mb-4">Raspadas vs. qualificadas na última semana</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} barGap={4}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="empresas" fill="hsl(220, 14%, 20%)" radius={[4, 4, 0, 0]} name="Raspadas" />
                <Bar dataKey="qualificadas" fill="hsl(45, 100%, 58%)" radius={[4, 4, 0, 0]} name="Qualificadas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="glass rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Funil de Conversão Semanal</h3>
          <p className="text-xs text-muted-foreground mb-4">Do scraping à reunião</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={conversionData}>
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="raspadas" stackId="1" stroke="hsl(210, 80%, 60%)" fill="hsl(210, 80%, 60%)" fillOpacity={0.15} name="Raspadas" />
                <Area type="monotone" dataKey="qualificadas" stackId="2" stroke="hsl(45, 100%, 58%)" fill="hsl(45, 100%, 58%)" fillOpacity={0.2} name="Qualificadas" />
                <Area type="monotone" dataKey="reunioes" stackId="3" stroke="hsl(142, 71%, 45%)" fill="hsl(142, 71%, 45%)" fillOpacity={0.3} name="Reuniões" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector distribution */}
        <div className="glass rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Distribuição por Setor</h3>
          <p className="text-xs text-muted-foreground mb-4">Percentual de empresas qualificadas</p>
          <div className="flex items-center gap-6">
            <div className="h-[180px] w-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sectorData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {sectorData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {sectorData.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-mono font-bold text-foreground ml-auto">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* IPC Score trend */}
        <div className="glass rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Evolução do Score IPC Médio</h3>
          <p className="text-xs text-muted-foreground mb-4">Qualidade dos leads ao longo do tempo</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ipcTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 85]} tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="score" stroke="hsl(45, 100%, 58%)" strokeWidth={2.5} dot={{ fill: "hsl(45, 100%, 58%)", r: 4 }} name="Score IPC" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
