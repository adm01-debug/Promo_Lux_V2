import { useState } from "react";
import { Copy, Loader2, Mail, Pencil, Plus, Search, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DataError } from "@/components/lux/DataError";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_VARIABLES,
  useDeleteEmailTemplate,
  useDuplicateEmailTemplate,
  useEmailTemplateStats,
  useEmailTemplates,
  useSaveEmailTemplate,
  type EmailTemplate,
  type EmailTemplateInput,
} from "@/hooks/useEmailTemplates";

const CATEGORY_LABEL: Record<string, string> = {
  prospeccao: "Prospecção",
  "follow-up": "Follow-up",
  reuniao: "Reunião",
  proposta: "Proposta",
  reativacao: "Reativação",
  geral: "Geral",
};

const EMPTY: EmailTemplateInput = {
  name: "",
  description: "",
  category: "geral",
  subject: "",
  body: "",
  variables: [],
  tags: [],
};

export function EmailTemplatesTab() {
  const { data: templates, isLoading, error, refetch } = useEmailTemplates();
  const { data: stats } = useEmailTemplateStats();
  const save = useSaveEmailTemplate();
  const remove = useDeleteEmailTemplate();
  const duplicate = useDuplicateEmailTemplate();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmailTemplateInput>(EMPTY);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");

  const patch = (p: Partial<EmailTemplateInput>) => setForm((f) => ({ ...f, ...p }));

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? "",
      category: t.category,
      subject: t.subject ?? "",
      body: t.body ?? "",
      variables: t.variables,
      tags: t.tags,
    });
    setOpen(true);
  };

  const onSubmit = async () => {
    if (!form.name.trim()) return;
    await save.mutateAsync({ ...form, id: editingId ?? undefined });
    setOpen(false);
  };

  const insertVariable = (v: string) => patch({ body: `${form.body ?? ""}${v}` });

  if (error) return <DataError message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const list = (templates ?? []).filter((t) => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || t.name.toLowerCase().includes(q) || (t.subject ?? "").toLowerCase().includes(q);
    const matchC = categoryFilter === "todas" || t.category === categoryFilter;
    return matchQ && matchC;
  });

  const totalUsos = (stats ?? []).reduce((s, r) => s + (r.usos_totais ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou assunto"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {TEMPLATE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="gap-1 text-[11px]">
          <TrendingUp className="h-3 w-3" /> {totalUsos} usos
        </Badge>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo template
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum template na biblioteca</p>
            <p className="text-xs text-muted-foreground">
              Salve o texto que já converte e reaproveite em qualquer campanha da organização.
            </p>
            <Button size="sm" variant="outline" onClick={openNew} className="mt-1 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Criar o primeiro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <Card key={t.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-tight">{t.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {CATEGORY_LABEL[t.category] ?? t.category}
                  </Badge>
                </div>
                {t.subject && (
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{t.subject}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                  {t.body || "Sem corpo"}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {t.variables.slice(0, 3).map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px]">{v}</Badge>
                  ))}
                  {t.version > 1 && (
                    <Badge variant="outline" className="text-[10px]">v{t.version}</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{t.usage_count} usos</Badge>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-7 gap-1 px-2 text-[11px]">
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => duplicate.mutate(t.id)}
                    disabled={duplicate.isPending}
                    className="h-7 gap-1 px-2 text-[11px]"
                  >
                    <Copy className="h-3 w-3" /> Duplicar
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => remove.mutate(t.id)}
                    disabled={remove.isPending}
                    className="h-7 gap-1 px-2 text-[11px] text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" /> Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingId ? "Editar template" : "Novo template"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fica disponível para todos os membros da organização.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Ex: Follow-up pós-demo"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => patch({ category: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Assunto</Label>
              <Input
                value={form.subject ?? ""}
                onChange={(e) => patch({ subject: e.target.value })}
                placeholder="{{empresa}} — uma ideia rápida"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Corpo</Label>
              <Textarea
                value={form.body ?? ""}
                onChange={(e) => patch({ body: e.target.value })}
                placeholder="Olá {{contato}}, vi que a {{empresa}} atua em {{segmento}}..."
                className="min-h-[140px] text-sm"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição interna (opcional)</Label>
              <Input
                value={form.description ?? ""}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Quando usar este template"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={!form.name.trim() || save.isPending}
              className="gap-1.5"
            >
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}