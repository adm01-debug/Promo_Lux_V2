import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Deal } from "@/hooks/useDeals";

interface Props {
  deal: Deal;
  onClick: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-primary",
  high: "text-destructive",
};

export function DealCard({ deal, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: "deal", deal },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const formattedValue = (deal.value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: deal.currency || "BRL",
    maximumFractionDigits: 0,
  });

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      whileHover={{ y: -2 }}
      className={cn(
        "glass rounded-lg p-3 cursor-grab active:cursor-grabbing border border-border/40",
        "hover:border-primary/40 hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] transition-colors"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-foreground line-clamp-2">{deal.title}</h4>
        <Flag className={cn("h-3.5 w-3.5 shrink-0", PRIORITY_COLORS[deal.priority])} />
      </div>
      <p className="text-base font-semibold text-primary glow-text">{formattedValue}</p>
      {deal.expected_close_date && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {format(new Date(deal.expected_close_date), "dd MMM", { locale: ptBR })}
        </div>
      )}
      {deal.tags && deal.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {deal.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}