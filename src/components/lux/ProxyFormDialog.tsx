import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCreateProxy, useUpdateProxy, type OrgProxy, type ProxyInput } from "@/hooks/useOrgProxies";

const schema = z.object({
  label: z.string().trim().min(1, "Informe um rótulo").max(80),
  proxy_type: z.enum(["http", "https", "socks5"]),
  url: z
    .string()
    .trim()
    .min(5, "URL inválida")
    .max(500)
    .refine((v) => /^(https?|socks5):\/\//i.test(v), "URL deve começar com http://, https:// ou socks5://"),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proxy?: OrgProxy | null;
}

export const ProxyFormDialog = ({ open, onOpenChange, proxy }: Props) => {
  const create = useCreateProxy();
  const update = useUpdateProxy();
  const isEdit = !!proxy;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: "",
      proxy_type: "http",
      url: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        proxy
          ? {
              label: proxy.label,
              proxy_type: (proxy.proxy_type as ProxyInput["proxy_type"]) ?? "http",
              url: proxy.url,
              is_active: proxy.is_active,
            }
          : { label: "", proxy_type: "http", url: "", is_active: true }
      );
    }
  }, [open, proxy, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && proxy) {
        await update.mutateAsync({ id: proxy.id, ...values });
        toast.success("Proxy atualizado");
      } else {
        await create.mutateAsync(values);
        toast.success("Proxy criado");
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Falha ao salvar proxy: ${msg}`);
    }
  };

  const submitting = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar proxy" : "Novo proxy"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label">Rótulo</Label>
            <Input id="label" placeholder="ex: BR-SP-Residencial-01" {...form.register("label")} />
            {form.formState.errors.label && (
              <p className="text-xs text-destructive">{form.formState.errors.label.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={form.watch("proxy_type")}
              onValueChange={(v) => form.setValue("proxy_type", v as FormValues["proxy_type"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="https">HTTPS</SelectItem>
                <SelectItem value="socks5">SOCKS5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url">URL completa</Label>
            <Input
              id="url"
              placeholder="http://user:pass@host:porta"
              autoComplete="off"
              {...form.register("url")}
            />
            <p className="text-[11px] text-muted-foreground">
              Inclua credenciais no formato <code className="font-mono">user:pass@host:porta</code> se necessário.
            </p>
            {form.formState.errors.url && (
              <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/40 p-3">
            <div>
              <Label htmlFor="is_active" className="cursor-pointer">Ativo</Label>
              <p className="text-[11px] text-muted-foreground">Se desativado, não será injetado em novos jobs.</p>
            </div>
            <Switch
              id="is_active"
              checked={form.watch("is_active")}
              onCheckedChange={(v) => form.setValue("is_active", v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
