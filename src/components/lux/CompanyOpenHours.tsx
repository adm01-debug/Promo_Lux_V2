import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Formatos aceitos:
 * 1) Array de dias: [{ day: "monday" | 0..6, opens?: "HH:MM", closes?: "HH:MM", periods?: [{opens,closes}] }, ...]
 * 2) Objeto weekdayDescriptions da Places API: { weekday_text: ["Monday: 9AM-6PM", ...] }
 * 3) Objeto simples: { monday: "9-18", tuesday: "9-18", ... }
 */
interface Props {
  data: unknown;
}

const DAY_LABELS_PT: Record<string, string> = {
  monday: "Segunda", tuesday: "Terça", wednesday: "Quarta", thursday: "Quinta",
  friday: "Sexta", saturday: "Sábado", sunday: "Domingo",
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo",
};

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_INDEX_TO_KEY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

interface DayRow { key: string; label: string; ranges: string[]; }

const normalize = (data: unknown): DayRow[] => {
  if (!data) return [];

  // weekday_text da Places API
  if (typeof data === "object" && data !== null && "weekday_text" in data) {
    const arr = (data as { weekday_text?: unknown }).weekday_text;
    if (Array.isArray(arr)) {
      return arr.map((line, idx) => {
        const str = String(line);
        const [dayRaw, ...rest] = str.split(":");
        const dayKey = dayRaw.trim().toLowerCase();
        const label = DAY_LABELS_PT[dayKey] ?? dayRaw.trim();
        return { key: `wt-${idx}`, label, ranges: [rest.join(":").trim()].filter(Boolean) };
      });
    }
  }

  if (Array.isArray(data)) {
    return data.map((item, idx) => {
      const day = (item?.day ?? item?.weekday ?? idx) as string | number;
      const key = typeof day === "number" ? DAY_INDEX_TO_KEY[day % 7] : String(day).toLowerCase();
      const label = DAY_LABELS_PT[key] ?? String(day);
      const ranges: string[] = [];
      if (Array.isArray(item?.periods)) {
        for (const p of item.periods) {
          if (p?.opens && p?.closes) ranges.push(`${p.opens} – ${p.closes}`);
        }
      } else if (item?.opens && item?.closes) {
        ranges.push(`${item.opens} – ${item.closes}`);
      } else if (item?.hours) {
        ranges.push(String(item.hours));
      }
      return { key: `${key}-${idx}`, label, ranges };
    });
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    return DAY_ORDER.map((k) => {
      const v = obj[k] ?? obj[k.slice(0, 3)];
      const ranges: string[] = [];
      if (typeof v === "string") ranges.push(v);
      else if (Array.isArray(v)) v.forEach((r) => ranges.push(String(r)));
      return { key: k, label: DAY_LABELS_PT[k], ranges };
    }).filter((r) => r.ranges.length > 0);
  }

  return [];
};

const isOpenNow = (rows: DayRow[]): boolean => {
  const now = new Date();
  const todayKey = DAY_INDEX_TO_KEY[now.getDay()];
  const todayRow = rows.find((r) => r.key.startsWith(todayKey));
  if (!todayRow) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const range of todayRow.ranges) {
    const match = range.match(/(\d{1,2}):?(\d{2})?\s*[–\-a]+\s*(\d{1,2}):?(\d{2})?/);
    if (!match) continue;
    const openM = parseInt(match[1]) * 60 + parseInt(match[2] ?? "0");
    const closeM = parseInt(match[3]) * 60 + parseInt(match[4] ?? "0");
    if (minutes >= openM && minutes <= closeM) return true;
  }
  return false;
};

export const CompanyOpenHours = ({ data }: Props) => {
  const rows = normalize(data);

  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-4 text-center">
        Horários não disponíveis. Reprocesse o job com "reviews individuais" para coletar dados detalhados.
      </div>
    );
  }

  const openNow = isOpenNow(rows);
  const todayKey = DAY_INDEX_TO_KEY[new Date().getDay()];

  return (
    <Card className="p-3 bg-secondary/20 border-border/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Clock className="h-3 w-3 text-primary" /> Horário de funcionamento
        </div>
        <Badge
          variant="outline"
          className={
            openNow
              ? "text-[10px] bg-success/15 text-success border-success/30"
              : "text-[10px] bg-muted/50 text-muted-foreground border-border/40"
          }
        >
          {openNow ? "Aberto agora" : "Fechado agora"}
        </Badge>
      </div>
      <div className="space-y-1">
        {rows.map((row) => {
          const isToday = row.key.startsWith(todayKey);
          return (
            <div
              key={row.key}
              className={`flex items-center justify-between text-[11px] py-0.5 ${
                isToday ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              <span>{row.label}{isToday && " · hoje"}</span>
              <span className="font-mono">
                {row.ranges.length > 0 ? row.ranges.join(" · ") : "Fechado"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
