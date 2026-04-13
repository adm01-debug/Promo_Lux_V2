import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList,
} from "recharts";
import { Filter, DollarSign, TrendingUp } from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";
import { MiniDonut } from "./AnimatedDonut";
import { CustomTooltip } from "./AnalyticsChartTooltip";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } }),
};

interface ConversionTabProps {
  funnelData: { name: string; value: number; fill: string }[];
  roiData: { name: string; abertura: number; resposta: number; reunioes: number; roi: number }[];
  allCampaigns: any[];
  totalProspects: number;
  totalMeetings: number;
  conversionRate: string;
}

export const ConversionTab = ({ funnelData, roiData, allCampaigns, totalProspects, totalMeetings, conversionRate }: ConversionTabProps) => (
  <div className="space-y-6">
    {/* Funnel stats row */}
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {funnelData.map((step, i) => {
        const pct = totalProspects > 0 ? Math.round((step.value / totalProspects) * 100) : 0;
        return (
          <motion.div key={step.name} custom={i} variants={cardVariants} initial="hidden" animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="glass rounded-lg p-3 flex flex-col items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{step.name}</span>
            <MiniDonut percentage={pct} color={step.fill} />
            <p className="text-lg font-bold font-mono text-foreground">
              <AnimatedCounter value={step.value} />
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{pct}%</p>
          </motion.div>
        );
      })}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Conversion Funnel */}
      <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          Funil de Conversão
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          De prospects a reuniões — taxa geral: <span className="font-mono font-bold text-primary">{conversionRate}%</span>
        </p>
        <div className="h-[280px]">
          {funnelData.some((s) => s.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip content={<CustomTooltip />} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="hsl(48, 20%, 96%)" fontSize={11} fontFamily="JetBrains Mono, monospace" formatter={(v: number) => v.toLocaleString()} />
                  <LabelList position="center" fill="hsl(225, 30%, 3%)" fontSize={10} fontWeight={600} dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Sem dados de campanhas para exibir o funil
            </div>
          )}
        </div>
      </motion.div>

      {/* ROI per Campaign */}
      <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          ROI por Campanha
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Taxas de abertura, resposta e conversão para reunião</p>
        <div className="h-[280px]">
          {roiData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roiData} barGap={2} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} unit="%" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "hsl(215, 12%, 50%)" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="abertura" fill="hsl(210, 80%, 60%)" radius={[0, 4, 4, 0]} name="Abertura %" barSize={8} />
                <Bar dataKey="resposta" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} name="Resposta %" barSize={8} />
                <Bar dataKey="roi" fill="hsl(45, 100%, 58%)" radius={[0, 4, 4, 0]} name="Conv. Reunião %" barSize={8} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Nenhuma campanha com envios para calcular ROI
            </div>
          )}
        </div>
      </motion.div>
    </div>

    {/* Campaign comparison table */}
    {allCampaigns.length > 0 && (
      <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible" className="glass rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Comparativo de Campanhas
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Performance detalhada por campanha</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Campanha</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Prospects</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Enviados</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Abertura</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Resposta</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Reuniões</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Conv. %</th>
              </tr>
            </thead>
            <tbody>
              {allCampaigns.map((c) => {
                const openRate = c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0;
                const replyRate = c.sent > 0 ? Math.round((c.replied / c.sent) * 100) : 0;
                const convRate = c.prospects > 0 ? ((c.meetings / c.prospects) * 100).toFixed(1) : "0";
                return (
                  <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="p-3 font-medium text-foreground">{c.name}</td>
                    <td className="p-3 text-right font-mono">{c.prospects}</td>
                    <td className="p-3 text-right font-mono">{c.sent}</td>
                    <td className="p-3 text-right font-mono">{openRate}%</td>
                    <td className="p-3 text-right font-mono">{replyRate}%</td>
                    <td className="p-3 text-right font-mono font-bold text-primary">{c.meetings}</td>
                    <td className="p-3 text-right font-mono font-bold" style={{ color: Number(convRate) > 5 ? "hsl(142, 71%, 45%)" : "hsl(215, 12%, 50%)" }}>
                      {convRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    )}
  </div>
);
