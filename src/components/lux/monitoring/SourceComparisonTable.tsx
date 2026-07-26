import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPct, type SourceQualityRow } from "@/lib/sourceQualityReport";

export interface SourceComparisonTableProps {
  rows: readonly SourceQualityRow[];
  bucket: "day" | "week" | "month";
}

const HEADERS = [
  "Período",
  "Fila",
  "Fonte",
  "Contatos",
  "E-mail confirmado",
  "Cobertura BR",
  "Supressão",
];

const bucketLabel = (iso: string, bucket: SourceComparisonTableProps["bucket"]): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  if (bucket === "month") return format(date, "MMM/yyyy", { locale: ptBR });
  if (bucket === "week") return `Sem. ${format(date, "dd/MM", { locale: ptBR })}`;
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

/** Tabela detalhada do relatório: uma linha por período × fila × fonte. */
export function SourceComparisonTable({ rows, bucket }: SourceComparisonTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum contato registrado no período e fila selecionados.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 text-left text-xs uppercase text-muted-foreground">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.bucket_start}-${row.queue}-${row.source}`}
              className="border-b border-border/30 last:border-0 hover:bg-secondary/30"
            >
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                {bucketLabel(row.bucket_start, bucket)}
              </td>
              <td className="px-3 py-2">{row.queue}</td>
              <td className="px-3 py-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    row.source === "apollo"
                      ? "border-primary/40 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {row.source}
                </Badge>
              </td>
              <td className="px-3 py-2 font-mono">{row.total}</td>
              <td className="px-3 py-2 font-mono">
                {formatPct(row.email_rate)}{" "}
                <span className="text-xs text-muted-foreground">({row.with_email})</span>
              </td>
              <td className="px-3 py-2 font-mono">
                {formatPct(row.br_rate)}{" "}
                <span className="text-xs text-muted-foreground">({row.br_count})</span>
              </td>
              <td className="px-3 py-2 font-mono">
                {formatPct(row.suppression_rate)}{" "}
                <span className="text-xs text-muted-foreground">({row.suppressed})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
