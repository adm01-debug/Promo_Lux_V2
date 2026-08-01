import { Building2, ExternalLink, MapPin, Tag, Sparkles, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useVirtualCompanies } from "@/hooks/useVirtualCompanies";
import { useVirtualization } from "@/hooks/useVirtualization";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";
import { motion, useMotionValue, animate, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

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
      delay: i * 0.01,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export const CompanyTable = () => {
  const { data: companies, isLoading } = useVirtualCompanies(500); // Increased from 200 to 500 for better demo
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(480);

  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight);
    }
  }, []);

  const { virtualItems, totalHeight, onScroll } = useVirtualization(companies || [], {
    itemHeight: 72, 
    overscan: 5,
    containerHeight
  });

  return (
    <div className="glass rounded-lg overflow-hidden flex flex-col h-[500px]">
      <div className="p-5 border-b border-border/50 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Empresas Identificadas</h2>
          <p className="text-sm text-muted-foreground">Últimas empresas que se encaixam no IPC (Virtualizadas)</p>
        </div>
        {companies && companies.length > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="text-[9px] font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-full font-medium"
          >
            {companies.length} carregadas
          </motion.span>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative bg-background/5">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
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
          <div 
            ref={containerRef}
            className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-primary/10"
            onScroll={onScroll}
          >
            <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-background/95 backdrop-blur sticky top-0 z-20 shadow-sm">
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium border-b border-border/50 w-1/3">Empresa / CNPJ</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium border-b border-border/50">Setor</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium border-b border-border/50">Localização</th>
                    <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium border-b border-border/50">Score IPC</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium border-b border-border/50">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {virtualItems.map(({ item: company, top }, i) => (
                    <motion.tr
                      key={company.id}
                      custom={i}
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                      whileHover={{
                        backgroundColor: "hsl(var(--primary) / 0.04)",
                        transition: { duration: 0.1 },
                      }}
                      className="cursor-pointer group absolute left-0 right-0 border-b border-border/10 flex items-center"
                      style={{ 
                        top, 
                        height: 72,
                      }}
                    >
                      <td className="p-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="h-9 w-9 rounded-lg bg-secondary/80 flex items-center justify-center shrink-0 ring-1 ring-border/30 group-hover:ring-primary/30 transition-all overflow-hidden">
                            {(company as { thumbnail_url?: string }).thumbnail_url ? (
                              <img
                                src={(company as { thumbnail_url: string }).thumbnail_url}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <Building2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-200 truncate">
                                {company.name}
                              </span>
                              {company.website && (
                                <a href={company.website} target="_blank" rel="noopener noreferrer" className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors" />
                                </a>
                              )}
                              {company.enriched && (
                                <Sparkles className="h-3 w-3 text-primary/70 animate-pulse shrink-0" />
                              )}
                              {(company as { rating?: number | null }).rating != null && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-warning font-medium">
                                  <Star className="h-2.5 w-2.5 fill-warning" />
                                  {(company as { rating: number }).rating.toFixed(1)}
                                  {(company as { review_count?: number | null }).review_count ? (
                                    <span className="text-muted-foreground/60">({(company as { review_count: number }).review_count})</span>
                                  ) : null}
                                </span>
                              )}
                            </div>
                            {company.cnpj && (
                              <span className="text-[10px] text-muted-foreground/60 font-mono block mt-0.5 truncate">
                                {company.cnpj}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 w-40">
                        <Badge variant="outline" className="text-[10px] gap-1 bg-secondary/50 truncate max-w-full">
                          <Tag className="h-2.5 w-2.5" />
                          {company.sector ?? "—"}
                        </Badge>
                      </td>
                      <td className="p-3 w-40 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-2.5 w-2.5" />
                          {company.location ?? "—"}
                        </span>
                      </td>
                      <td className="p-3 w-24 text-center">
                        <div className={cn(
                          "inline-flex items-center justify-center h-7 w-10 rounded-lg ring-1 transition-all duration-200",
                          getScoreBg(company.ipc_score ?? 0),
                          getScoreGlow(company.ipc_score ?? 0)
                        )}>
                          <span className={cn("font-mono font-bold text-xs", getScoreColor(company.ipc_score ?? 0))}>
                            <AnimatedScore value={company.ipc_score ?? 0} />
                          </span>
                        </div>
                      </td>
                      <td className="p-3 w-32">
                        <span className="text-muted-foreground text-[10px] bg-secondary/30 px-2 py-0.5 rounded-full truncate block max-w-full text-center">
                          {company.source}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
