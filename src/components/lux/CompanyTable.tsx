import { Building2, ExternalLink, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRecentCompanies } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/lux/EmptyState";

const getScoreColor = (score: number) => {
  if (score >= 90) return "text-success";
  if (score >= 75) return "text-primary";
  return "text-warning";
};

export const CompanyTable = () => {
  const { data: companies, isLoading } = useRecentCompanies(6);

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <h2 className="text-lg font-semibold text-foreground">Empresas Identificadas</h2>
        <p className="text-sm text-muted-foreground">Últimas empresas que se encaixam no IPC</p>
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
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Empresa</th>
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Setor</th>
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Localização</th>
                <th className="text-center p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Score IPC</th>
                <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{company.name}</span>
                        {company.website && <ExternalLink className="inline h-3 w-3 ml-1.5 text-muted-foreground" />}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs gap-1 bg-secondary/50">
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
                    <span className={`font-mono font-bold text-lg ${getScoreColor(company.ipc_score ?? 0)}`}>
                      {company.ipc_score ?? 0}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{company.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
