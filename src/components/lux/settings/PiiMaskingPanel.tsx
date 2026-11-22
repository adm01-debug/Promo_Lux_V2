import { useState } from "react";
import { ShieldCheck, Loader2, ScanSearch, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PII_ACTION_LABEL,
  PII_CATEGORY_LABEL,
  usePiiPreview,
  usePiiRules,
  usePiiScan,
  type PiiAction,
  type PiiCategory,
} from "@/hooks/usePiiRules";

export function PiiMaskingPanel() {
  const { data: rules, isLoading, error, setRule } = usePiiRules();
  const scan = usePiiScan();
  const preview = usePiiPreview();
  const [sample, setSample] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando regras de PII...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
        Nao foi possivel carregar as regras: {(error as Error).message}
      </div>
    );
  }

  const scanRows = scan.data ?? [];
  const exposed = scanRows.filter((r) => Number(r.rows_with_pii) > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-medium">Mascaramento de dados sensiveis (DLP)</p>
          <p className="text-xs text-muted-foreground">
            Define como CPF, CNPJ, e-mail, telefone, cartao e tokens sao
            tratados no audit log e nas exportacoes. As regras valem para toda
            a organizacao.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Acao</TableHead>
              <TableHead className="w-[100px] text-right">Ativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rules ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  Nenhuma regra configurada.
                </TableCell>
              </TableRow>
            )}
            {(rules ?? []).map((r) => (
              <TableRow key={r.category}>
                <TableCell className="font-medium">
                  {PII_CATEGORY_LABEL[r.category] ?? r.category}
                </TableCell>
                <TableCell>
                  <Select
                    value={r.action}
                    onValueChange={(v) =>
                      setRule.mutate({
                        category: r.category,
                        action: v as PiiAction,
                        enabled: r.enabled,
                      })
                    }
                    disabled={setRule.isPending}
                  >
                    <SelectTrigger className="h-8 w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["mask", "redact", "hash"] as PiiAction[]).map((a) => (
                        <SelectItem key={a} value={a}>
                          {PII_ACTION_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Switch
                    checked={r.enabled}
                    disabled={setRule.isPending}
                    onCheckedChange={(checked) =>
                      setRule.mutate({
                        category: r.category,
                        action: r.action,
                        enabled: checked,
                      })
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 rounded-lg border border-border/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Mapeamento de PII armazenada</p>
            <p className="text-xs text-muted-foreground">
              Varre as colunas de texto da organizacao e mostra onde ha dados
              sensiveis ainda sem tratamento.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
          >
            {scan.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="mr-2 h-4 w-4" />
            )}
            Varrer agora
          </Button>
        </div>

        {scan.data && (
          <div className="text-sm">
            {exposed.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhuma coluna exposta encontrada.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {exposed.length} coluna(s) com PII detectada
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Coluna</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Com PII</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exposed.map((row) => (
                      <TableRow key={`${row.table_name}.${row.column_name}`}>
                        <TableCell className="font-mono text-xs">
                          {row.table_name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.column_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PII_CATEGORY_LABEL[row.category] ?? row.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.rows_with_pii}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.rows_total}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border/50 p-4">
        <div>
          <p className="text-sm font-medium">Testar mascaramento</p>
          <p className="text-xs text-muted-foreground">
            Escreva um texto com dados sensiveis para ver como ele sai depois
            das regras ativas.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pii-sample" className="text-xs">
            Texto de exemplo
          </Label>
          <Input
            id="pii-sample"
            value={sample}
            placeholder="ex.: falei com joao@empresa.com, CPF 123.456.789-00"
            onChange={(e) => setSample(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => preview.mutate(sample)}
          disabled={preview.isPending || !sample.trim()}
        >
          {preview.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Eye className="mr-2 h-4 w-4" />
          )}
          Pré-visualizar
        </Button>
        {preview.data !== undefined && preview.data !== "" && (
          <div className="rounded-md border border-border/50 bg-muted/40 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <EyeOff className="h-3 w-3" />
              Resultado
            </div>
            <p className="break-all font-mono text-xs">{preview.data}</p>
          </div>
        )}
      </div>
    </div>
  );
}