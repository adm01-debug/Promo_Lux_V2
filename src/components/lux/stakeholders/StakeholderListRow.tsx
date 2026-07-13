import { Mail, Check } from "lucide-react";
import { LinkedinIcon as Linkedin } from "@/components/lux/icons/LinkedinIcon";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { getSeniority, getScoreGradient, getInitials } from "./stakeholder-utils";

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

interface StakeholderListRowProps {
  stakeholder: Stakeholder;
  index: number;
  copiedEmail: string | null;
  onCopyEmail: (email: string) => void;
}

export const StakeholderListRow = ({ stakeholder: s, index, copiedEmail, onCopyEmail }: StakeholderListRowProps) => {
  const sen = getSeniority(s.seniority);
  const score = s.confidence_score || 0;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      className="hover:bg-secondary/20 transition-colors"
    >
      <td className="p-3">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${getScoreGradient(score)} flex items-center justify-center text-[10px] font-bold text-background flex-shrink-0`}>
            {getInitials(s.full_name)}
          </div>
          <div>
            <span className="font-medium text-foreground text-sm">{s.full_name}</span>
            {s.tags && s.tags.length > 0 && (
              <div className="flex gap-1 mt-0.5">
                {s.tags.slice(0, 2).map((tag, ti) => (
                  <span key={ti} className="text-[8px] text-primary/60">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{s.role || "—"}</td>
      <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">{s.department || "—"}</td>
      <td className="p-3 text-center">
        <Badge variant="outline" className={`text-[9px] gap-0.5 ${sen.color}`}>
          {sen.label}
        </Badge>
      </td>
      <td className="p-3 text-center">
        <span className={`font-mono font-bold text-sm ${
          score >= 85 ? "text-emerald-400" : score >= 70 ? "text-primary" : score >= 50 ? "text-amber-400" : "text-red-400"
        }`}>
          {score}
        </span>
      </td>
      <td className="p-3 text-center hidden sm:table-cell">
        <div className="flex items-center justify-center gap-1.5">
          {s.email && (
            <button
              onClick={() => onCopyEmail(s.email!)}
              className="h-6 w-6 rounded bg-secondary/50 flex items-center justify-center hover:bg-primary/20 transition-colors"
              title={s.email}
            >
              {copiedEmail === s.email ? <Check className="h-3 w-3 text-success" /> : <Mail className="h-3 w-3 text-muted-foreground" />}
            </button>
          )}
          {s.linkedin_url && (
            <a href={s.linkedin_url} target="_blank" rel="noopener"
              className="h-6 w-6 rounded bg-secondary/50 flex items-center justify-center hover:bg-blue-500/20 transition-colors">
              <Linkedin className="h-3 w-3 text-blue-400" />
            </a>
          )}
          {!s.email && !s.linkedin_url && (
            <span className="text-[9px] text-muted-foreground/40">—</span>
          )}
        </div>
      </td>
    </motion.tr>
  );
};
