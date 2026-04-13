import { Mail, ExternalLink, Star, Check } from "lucide-react";
import { LinkedinIcon as Linkedin } from "@/components/lux/icons/LinkedinIcon";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface Stakeholder {
  id: string;
  full_name: string;
  role: string | null;
  department: string | null;
  seniority: string | null;
  email: string | null;
  linkedin_url: string | null;
  confidence_score: number | null;
  tags: string[] | null;
}

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

interface StakeholderCardProps {
  stakeholder: Stakeholder;
  index: number;
  isExpanded: boolean;
  copiedEmail: string | null;
  onToggleExpand: () => void;
  onCopyEmail: (email: string) => void;
}

export const StakeholderCard = ({ stakeholder: s, index, isExpanded, copiedEmail, onToggleExpand, onCopyEmail }: StakeholderCardProps) => {
  const sen = getSeniority(s.seniority);
  const score = s.confidence_score || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03 }}
      className="glass rounded-xl p-4 hover:border-primary/30 transition-all group cursor-pointer relative overflow-hidden"
      onClick={onToggleExpand}
    >
      {/* Score bar at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5">
        <div className={`h-full bg-gradient-to-r ${getScoreGradient(score)} transition-all`} style={{ width: `${score}%` }} />
      </div>

      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${getScoreGradient(score)} flex items-center justify-center text-sm font-bold text-background shadow-lg`}>
            {getInitials(s.full_name)}
          </div>
          {score >= 85 && (
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
              <Star className="h-2.5 w-2.5 text-primary-foreground fill-primary-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">{s.full_name}</h3>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{s.role || "Cargo desconhecido"}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[9px] gap-0.5 py-0 ${sen.color}`}>
              {sen.label}
            </Badge>
            {s.department && (
              <Badge variant="outline" className="text-[9px] bg-secondary/50 py-0">{s.department}</Badge>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-center">
          <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold ${
            score >= 85 ? "border-emerald-500/50 text-emerald-400" :
            score >= 70 ? "border-primary/50 text-primary" :
            score >= 50 ? "border-amber-500/50 text-amber-400" :
            "border-red-500/50 text-red-400"
          }`}>
            {score}
          </div>
        </div>
      </div>

      {/* Contact row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
        {s.email && (
          <button
            onClick={(e) => { e.stopPropagation(); onCopyEmail(s.email!); }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          >
            {copiedEmail === s.email ? <Check className="h-3 w-3 text-success" /> : <Mail className="h-3 w-3" />}
            <span className="truncate max-w-[120px]">{s.email}</span>
          </button>
        )}
        {s.linkedin_url && (
          <a href={s.linkedin_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors ml-auto">
            <Linkedin className="h-3 w-3" /> LinkedIn
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
        {!s.email && !s.linkedin_url && (
          <span className="text-[10px] text-muted-foreground/50 italic">Sem dados de contato</span>
        )}
      </div>

      {s.tags && s.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {s.tags.map((tag, ti) => (
            <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/70 border border-primary/10">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};
