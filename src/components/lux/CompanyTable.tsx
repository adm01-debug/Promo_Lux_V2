import { Building2, ExternalLink, MapPin, Tag, HelpCircle, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useRecentCompanies } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { motion, useMotionValue, animate, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

/* Animated score that counts up */
const AnimatedScore = ({ value }: { value: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true });
  const motionVal = useMotionValue(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionVal, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => { if (ref.current) ref.current.textContent = String(Math.round(v)); },
    });
    return () => controls.stop();
  }, [value, isInView, motionVal]);

  return <span ref={containerRef}><span ref={ref}>0</span></span>;
};

const getScoreColor = (score: number) => {
  if (score >= 90) return "text-success";
  if (score >= 75) return "text-primary";
  if (score >= 60) return "text-warning";
  return "text-muted-foreground";
};

const getScoreBg = (score: number) => {
  if (score >= 90) return "bg-success/10 ring-success/20";
  if (score >= 75) return "bg-primary/10 ring-primary/20";
  if (score >= 60) return "bg-warning/10 ring-warning/20";
  return "bg-muted/10 ring-muted/20";
};

const getScoreGlow = (score: number) => {
  if (score >= 90) return "group-hover:shadow-[0_0_12px_hsl(var(--success)/0.3)]";
  if (score >= 75) return "group-hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)]";
  return "";
};

const rowVariants = {
  hidden: { opacity: 0, x: -16, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: i * 0.06,
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export const CompanyTable = () => {
  const { data: companies, isLoading } = useRecentCompanies(6);

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Empresas Identificadas</h2>
          <p className="text-sm text-muted-foreground">Últimas empresas que se encaixam no IPC</p>
        </div>
        {companies && companies.length > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="text-[9px] font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-full font-medium"
          >
            {companies.length} recentes
          </motion.span>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>
      ) : !companies || companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa ainda"
          description="Empresas aparecerão aqui conforme forem raspadas e identificadas pelo IPC."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Empresa / CNPJ</th>
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Setor</th>
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Localização</th>
                <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-help">
                        Score IPC
                        <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                      <p className="font-semibold mb-1">Score do Perfil de Cliente Ideal</p>
                      <p className="text-muted-foreground">90+ Excelente · 75-89 Bom · 60-74 Médio · &lt;60 Baixo.</p>
                    </TooltipContent>
                  </Tooltip>
                </th>
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {companies.map((company, i) => (
                <motion.tr
                  key={company.id}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{
                    backgroundColor: "hsl(var(--primary) / 0.04)",
                    x: 2,
                    transition: { duration: 0.2 },
                  }}
                  className="cursor-pointer group transition-all duration-200"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 4 }}
                        transition={{ type: "spring", stiffness: 400 }}
                        className="h-9 w-9 rounded-lg bg-secondary/80 flex items-center justify-center ring-1 ring-border/30 group-hover:ring-primary/30 transition-all"
                      >
                        <Building2 className="h-4 w-4 text-primary" />
                      </motion.div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-200">
                            {company.name}
                          </span>
                          {company.website && (
                            <a href={company.website} target="_blank" rel="noopener noreferrer" className="inline-block" onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors" />
                            </a>
                          )}
                          {company.enriched && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Sparkles className="h-3 w-3 text-primary/70 animate-pulse" />
                              </TooltipTrigger>
                              <TooltipContent>Dados enriquecidos com IA</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {company.cnpj && (
                          <span className="text-[10px] text-muted-foreground/60 font-mono block mt-0.5">
                            {company.cnpj}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs gap-1 bg-secondary/50 group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                      <Tag className="h-3 w-3" />
                      {company.sector ?? "—"}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {company.location ?? "—"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <motion.div
                      whileHover={{ scale: 1.15 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className={cn(
                        "inline-flex items-center justify-center h-8 w-12 rounded-lg ring-1 transition-all duration-200",
                        getScoreBg(company.ipc_score ?? 0),
                        getScoreGlow(company.ipc_score ?? 0)
                      )}
                    >
                      <span className={cn("font-mono font-bold text-sm", getScoreColor(company.ipc_score ?? 0))}>
                        <AnimatedScore value={company.ipc_score ?? 0} />
                      </span>
                    </motion.div>
                  </td>
                  <td className="p-3">
                    <span className="text-muted-foreground text-xs bg-secondary/30 px-2 py-0.5 rounded-full">
                      {company.source}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
