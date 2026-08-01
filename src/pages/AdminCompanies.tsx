import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminCompany {
  id: string;
  name: string;
  sector: string | null;
  location: string | null;
  ipc_score: number | null;
  enriched: boolean | null;
  starred: boolean | null;
  organization_id: string | null;
  created_at: string;
}

interface AdminResponse {
  total: number;
  count: number;
  companies: AdminCompany[];
}

const ORG_LABELS: Record<string, string> = {
  "6cd7921e-5753-40e5-a1c0-69ebc9c2f946": "Promo Brindes",
  "00000000-0000-0000-0000-000000000099": "Org de Testes (fixtures)",
  "561aefbc-70ad-4703-9bf1-81857bf8915c": "RLS Org A (testes)",
  "5812f8c5-192a-43e1-a167-76797f05c8d3": "RLS Org B (testes)",
  "ed34f25b-04d9-4060-ac37-028fdfe177e2": "RLS Org A (testes)",
  "3e6c8d89-5266-47cb-824e-12e15e57330c": "RLS Org B (testes)",
  "13f3e841-f8ed-48d4-bd2c-592fa7f264f0": "RLS Org A (testes)",
  "90be9ed2-6f00-4696-b537-a3242be30e34": "RLS Org B (testes)",
  "99999999-9999-9999-9999-999999999999": "Org inválida (teste órfão)",
};

function orgLabel(id: string | null): string {
  if (!id) return "—";
  return ORG_LABELS[id] ?? id.slice(0, 8);
}

export default function AdminCompaniesView() {
  const [search, setSearch] = useState("");
  const token = import.meta.env.VITE_ADMIN_LIST_TOKEN as string | undefined;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AdminResponse>({
    queryKey: ["admin-companies", search],
    enabled: !!token,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "500" });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-companies?${params}`,
        {
          method: "GET",
          headers: {
            "X-Admin-Token": token!,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
        }
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      return res.json();
    },
  });

  if (!token) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Admin token ausente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Defina <code className="px-1 py-0.5 rounded bg-muted">VITE_ADMIN_LIST_TOKEN</code> no seu <code className="px-1 py-0.5 rounded bg-muted">.env</code> com o mesmo valor configurado em <code className="px-1 py-0.5 rounded bg-muted">supabase secrets</code>.</p>
            <p>Reinicie o Vite após alterar o .env.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const byOrg = (data?.companies ?? []).reduce<Record<string, number>>((acc, c) => {
    const k = c.organization_id ?? "null";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Companies — Visão Admin</h1>
          <Badge variant="outline" className="ml-2">bypass RLS</Badge>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background hover:bg-muted text-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, setor ou cidade…"
                className="pl-9"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {data ? <><strong>{data.total}</strong> no total · <strong>{data.count}</strong> retornadas</> : "…"}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {isError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <strong>Erro:</strong> {(error as Error).message}
            </div>
          )}
          {data && data.companies.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Nome</th>
                    <th className="text-left py-2 px-3 font-medium">Setor</th>
                    <th className="text-left py-2 px-3 font-medium">Cidade</th>
                    <th className="text-right py-2 px-3 font-medium">IPC</th>
                    <th className="text-center py-2 px-3 font-medium">★</th>
                    <th className="text-center py-2 px-3 font-medium">Enriched</th>
                    <th className="text-left py-2 px-3 font-medium">Org</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companies.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted/40">
                      <td className="py-2 px-3 font-medium">{c.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.sector ?? "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.location ?? "—"}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{c.ipc_score ?? "—"}</td>
                      <td className="py-2 px-3 text-center">{c.starred ? "★" : ""}</td>
                      <td className="py-2 px-3 text-center">{c.enriched ? "✓" : ""}</td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {orgLabel(c.organization_id)}
                          {byOrg[c.organization_id ?? "null"] > 1 && (
                            <span className="ml-1 opacity-60">×{byOrg[c.organization_id ?? "null"]}</span>
                          )}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && data.companies.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma company encontrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
