import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { AnimatedCounter } from "./AnimatedCounter";
import { AnimatedDonut } from "./AnimatedDonut";
import { CustomTooltip } from "./AnalyticsChartTooltip";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } }),
};

interface DataEnrichmentTabProps {
  sourceData: { name: string; empresas: number; enriquecidas: number }[];
  scoreData: { range: string; count: number }[];
  sectorData: { name: string; value: number; color: string }[];
  totalCompanies: number;
  enrichedCount: number;
}

export const DataEnrichmentTab = ({ sourceData, scoreData, sectorData, totalCompanies, enrichedCount }: DataEnrichmentTabProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Companies by source */}
    <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Empresas por Fonte</h3>
      <p className="text-xs text-muted-foreground mb-4">Total vs enriquecidas por fonte de dados</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sourceData} barGap={4}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="empresas" fill="hsl(220, 14%, 20%)" radius={[4, 4, 0, 0]} name="Total" />
            <Bar dataKey="enriquecidas" fill="hsl(45, 100%, 58%)" radius={[4, 4, 0, 0]} name="Enriquecidas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>

    {/* Score distribution */}
    <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Distribuição de Score IPC</h3>
      <p className="text-xs text-muted-foreground mb-4">Quantidade de empresas por faixa de score</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={scoreData} layout="vertical" barSize={20}>
            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} />
            <YAxis dataKey="range" type="category" tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" fill="hsl(45, 100%, 58%)" radius={[0, 4, 4, 0]} name="Empresas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>

    {/* Sector distribution */}
    <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Distribuição por Setor</h3>
      <p className="text-xs text-muted-foreground mb-4">Percentual de empresas por setor</p>
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
        <div className="space-y-2 flex-1">
          {sectorData.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-muted-foreground truncate">{s.name}</span>
              <span className="font-mono font-bold text-foreground ml-auto">{s.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>

    {/* Enrichment rate */}
    <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5 flex flex-col justify-center">
      <h3 className="text-sm font-semibold text-foreground mb-1">Taxa de Enriquecimento</h3>
      <p className="text-xs text-muted-foreground mb-6">Percentual de empresas com dados completos</p>
      <div className="flex items-center justify-center">
        <AnimatedDonut
          percentage={totalCompanies > 0 ? Math.round((enrichedCount / totalCompanies) * 100) : 0}
          size={140}
          strokeWidth={12}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4">
        <AnimatedCounter value={enrichedCount} /> de <AnimatedCounter value={totalCompanies} /> empresas enriquecidas
      </p>
    </motion.div>
  </div>
);
