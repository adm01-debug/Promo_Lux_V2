const seniorityConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "c-level": { label: "C-Level", color: "bg-primary/20 text-primary border-primary/40", icon: null },
  "vp": { label: "VP", color: "bg-amber-500/20 text-amber-400 border-amber-500/40", icon: null },
  "director": { label: "Diretor", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", icon: null },
  "manager": { label: "Gerente", color: "bg-blue-500/20 text-blue-400 border-blue-500/40", icon: null },
  "coordinator": { label: "Coordenador", color: "bg-violet-500/20 text-violet-400 border-violet-500/40", icon: null },
  "senior": { label: "Sênior", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40", icon: null },
  "analyst": { label: "Analista", color: "bg-muted text-muted-foreground border-border/50", icon: null },
  "unknown": { label: "Outro", color: "bg-muted text-muted-foreground border-border/50", icon: null },
};

export const getSeniority = (s: string | null) => seniorityConfig[s || "unknown"] || seniorityConfig["unknown"];

export const getScoreGradient = (score: number) => {
  if (score >= 85) return "from-emerald-500 to-emerald-400";
  if (score >= 70) return "from-primary to-amber-400";
  if (score >= 50) return "from-amber-500 to-orange-400";
  return "from-red-500 to-red-400";
};

export const getInitials = (name: string) => {
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};
