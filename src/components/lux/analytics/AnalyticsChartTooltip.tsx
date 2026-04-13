export interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

export const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="glass rounded-lg p-2.5 border border-border/50 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export const COLORS = [
  "hsl(45, 100%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(210, 80%, 60%)",
  "hsl(280, 70%, 55%)",
  "hsl(340, 70%, 55%)",
  "hsl(215, 12%, 50%)",
];
