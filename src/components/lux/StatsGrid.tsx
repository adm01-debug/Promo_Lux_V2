import { Activity, Zap, Building2, TrendingUp, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { motion, useMotionValue, animate } from "framer-motion";
import { useDashboardStats } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useMemo, memo } from "react";

/* ── Animated number counter ── */
const AnimatedNumber = ({ value, duration = 1.2 }: { value: number; duration?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = Math.round(latest).toLocaleString("pt-BR");
      },
    });
    return () => controls.stop();
  }, [value, duration, motionVal]);

  return <span ref={ref}>0</span>;
};

/* ── Mini sparkline SVG ── */
const Sparkline = ({ data, color, className }: { data: number[]; color: string; className?: string }) => {
  const width = 80;
  const height = 28;
  const padding = 2;

  const path = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = (width - padding * 2) / (data.length - 1);

    return data
      .map((v, i) => {
        const x = padding + i * stepX;
        const y = height - padding - ((v - min) / range) * (height - padding * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data]);

  const areaPath = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = (width - padding * 2) / (data.length - 1);

    const points = data.map((v, i) => {
      const x = padding + i * stepX;
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(" ")} L${(padding + (data.length - 1) * stepX).toFixed(1)},${height} L${padding},${height} Z`;
  }, [data]);

  if (data.length < 2) return null;

  return (
    <svg width={width} height={height} className={cn("overflow-visible", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-fill-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#spark-fill-${color.replace(/[^a-z0-9]/gi, "")})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
      />
      {/* Dot on last point */}
      {data.length >= 2 && (() => {
        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
        const range = max - min || 1;
        const stepX = (width - padding * 2) / (data.length - 1);
        const lastVal = data[data.length - 1];
        const cx = padding + (data.length - 1) * stepX;
        const cy = height - padding - ((lastVal - min) / range) * (height - padding * 2);
        return (
          <motion.circle
            cx={cx}
            cy={cy}
            r={2.5}
            fill={color}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.4, type: "spring", stiffness: 300 }}
          />
        );
      })()}
    </svg>
  );
};

/* ── Generate fake sparkline data from a seed value ── */
function generateSparkData(seed: number, points = 7): number[] {
  const data: number[] = [];
  let val = Math.max(seed * 0.4, 1);
  for (let i = 0; i < points; i++) {
    val = Math.max(0, val + (Math.sin(seed + i * 1.3) * seed * 0.15));
    data.push(Math.round(val));
  }
  // Ensure last point trends toward current value
  data[data.length - 1] = seed;
  return data;
}

interface StatCardProps {
  title: string;
  value: string | number;
  rawNumber?: number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  progress?: number;
  onClick?: () => void;
  featured?: boolean;
  suffix?: string;
  sparkData?: number[];
  sparkColor?: string;
}

const CARD_STYLES: Record<string, string> = {
  "Workflows Ativos": "border-violet-500/20",
  "Total de Empresas": "border-primary/40 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.2)]",
  "Empresas Qualificadas": "border-emerald-500/20",
  "Taxa de Conversão": "border-sky-500/20",
};

const ICON_BG: Record<string, string> = {
  "Workflows Ativos": "bg-violet-500/10 text-violet-400",
  "Total de Empresas": "bg-primary/10 text-primary",
  "Empresas Qualificadas": "bg-emerald-500/10 text-emerald-400",
  "Taxa de Conversão": "bg-sky-500/10 text-sky-400",
};

const SPARK_COLORS: Record<string, string> = {
  "Workflows Ativos": "#8b5cf6",
  "Total de Empresas": "hsl(45, 100%, 55%)",
  "Empresas Qualificadas": "#10b981",
  "Taxa de Conversão": "#0ea5e9",
};

const StatCard = ({ title, value, rawNumber, subtitle, icon, trend, trendUp = true, progress, onClick, featured, suffix, sparkData, sparkColor }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{
      y: -6,
      scale: 1.02,
      boxShadow: "0 20px 40px -12px rgba(0,0,0,0.3)",
      transition: { duration: 0.25, ease: "easeOut" },
    }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-label={`${title}: ${rawNumber !== undefined ? rawNumber : value}${suffix ?? ""}. ${subtitle}`}
    className={cn(
      "glass rounded-xl p-5 group transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 relative overflow-hidden",
      onClick && "cursor-pointer",
      featured && "breathe-glow",
      CARD_STYLES[title] || "hover:glow-primary"
    )}
  >
    {/* Hover glow overlay */}
    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-transparent via-transparent to-primary/5 pointer-events-none" />

    <div className="flex items-start justify-between mb-3 relative z-10">
      <span className={cn(
        "text-xs uppercase tracking-widest",
        featured ? "text-primary font-semibold" : "text-muted-foreground"
      )}>{title}</span>
      <motion.div
        whileHover={{ rotate: 8, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300 }}
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
          ICON_BG[title] || "bg-primary/10 text-primary"
        )}
      >
        {icon}
      </motion.div>
    </div>

    <div className="flex items-end justify-between relative z-10">
      <div>
        <p className={cn(
          "font-bold text-foreground tracking-tight font-mono",
          featured ? "text-4xl" : "text-3xl"
        )}>
          {rawNumber !== undefined ? (
            <><AnimatedNumber value={rawNumber} />{suffix ?? ""}</>
          ) : value}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-muted-foreground text-sm">{subtitle}</span>
          {trend && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="text-xs font-medium flex items-center gap-0.5 text-success"
            >
              <ArrowUpRight className="h-3 w-3" />
              {trend}
            </motion.span>
          )}
        </div>
      </div>

      {/* Sparkline */}
      {sparkData && sparkColor && (
        <div className="opacity-60 group-hover:opacity-100 transition-opacity duration-300">
          <Sparkline data={sparkData} color={sparkColor} />
        </div>
      )}
    </div>

    {progress !== undefined && (
      <div className="mt-3 h-1.5 bg-secondary/50 rounded-full overflow-hidden relative z-10">
        <motion.div
          className={cn(
            "h-full rounded-full",
            title === "Empresas Qualificadas" ? "bg-emerald-500" : title === "Taxa de Conversão" ? "bg-sky-500" : "bg-primary"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
        />
      </div>
    )}
  </motion.div>
);

const StatSkeleton = () => (
  <div className="glass rounded-xl p-5 space-y-3">
    <div className="flex items-start justify-between">
      <div className="skeleton-shimmer h-3 w-24 rounded" />
      <div className="skeleton-shimmer h-9 w-9 rounded-lg" />
    </div>
    <div className="skeleton-shimmer h-8 w-16 rounded" />
    <div className="skeleton-shimmer h-3 w-32 rounded" />
    <div className="skeleton-shimmer h-1.5 w-full rounded-full mt-1" />
  </div>
);

interface StatsGridProps {
  onNavigate?: (view: string) => void;
}

export const StatsGrid = memo(({ onNavigate }: StatsGridProps) => {
  const { data, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>
    );
  }

  const s = data!;
  const matchRate = s.totalCompanies > 0 ? Math.round((s.enrichedCompanies / s.totalCompanies) * 100) : 0;
  
  const stats: StatCardProps[] = [
    {
      title: "Total de Empresas",
      value: s.totalCompanies.toLocaleString("pt-BR"),
      rawNumber: s.totalCompanies,
      subtitle: `${s.enrichedCompanies} enriquecidas`,
      icon: <Building2 className="h-5 w-5" />,
      featured: true,
      trend: s.totalCompanies > 0 ? `${matchRate}% enr.` : undefined,
      trendUp: true,
      onClick: () => onNavigate?.("companies"),
      sparkData: generateSparkData(s.totalCompanies),
      sparkColor: SPARK_COLORS["Total de Empresas"],
    },
    {
      title: "Empresas Qualificadas",
      value: s.qualifiedCompanies.toLocaleString("pt-BR"),
      rawNumber: s.qualifiedCompanies,
      subtitle: `Score IPC >= 75`,
      icon: <CheckCircle2 className="h-5 w-5" />,
      trend: s.qualifiedCompanies > 0 ? `Score 75+` : undefined,
      trendUp: true,
      onClick: () => onNavigate?.("companies"),
      sparkData: generateSparkData(s.qualifiedCompanies),
      sparkColor: SPARK_COLORS["Empresas Qualificadas"],
      progress: s.totalCompanies > 0 ? Math.round((s.qualifiedCompanies / s.totalCompanies) * 100) : 0,
    },
    {
      title: "Taxa de Conversão",
      value: `${s.conversionRate}%`,
      rawNumber: s.conversionRate,
      suffix: "%",
      subtitle: "Qualificadas / Total",
      icon: <TrendingUp className="h-5 w-5" />,
      trend: s.conversionRate >= 15 ? "Excelente" : "Em crescimento",
      trendUp: s.conversionRate >= 15,
      progress: s.conversionRate,
      onClick: () => onNavigate?.("analytics"),
      sparkData: generateSparkData(s.conversionRate),
      sparkColor: SPARK_COLORS["Taxa de Conversão"],
    },
    {
      title: "Workflows Ativos",
      value: s.activeWorkflows,
      rawNumber: s.activeWorkflows,
      subtitle: `${s.runningWorkflows} em execução`,
      icon: <Zap className="h-5 w-5" />,
      trend: s.activeWorkflows > 0 ? `+${s.runningWorkflows}` : undefined,
      trendUp: true,
      onClick: () => onNavigate?.("workflows"),
      sparkData: generateSparkData(s.activeWorkflows),
      sparkColor: SPARK_COLORS["Workflows Ativos"],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, ease: "easeOut" }}>
          <StatCard {...stat} />
        </motion.div>
      ))}
    </div>
  );
});
