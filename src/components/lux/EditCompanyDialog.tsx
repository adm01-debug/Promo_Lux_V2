import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Loader2, Pencil, MapPin, CheckCircle2, XCircle, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { db, getActiveOrgId } from "@/integrations/supabase/withOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { validateCompany } from "@/lib/schemas/company";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { OrgMismatchError } from "@/integrations/supabase/withOrg";
import { handleOrgError } from "@/lib/orgErrorHandler";

type GeoStatus = "idle" | "checking" | "found" | "not_found";

interface EditCompanyDialogProps {
  company: {
    id: string;
    name: string;
    sector: string;
    location: string;
    email?: string;
    phone?: string;
    website?: string;
    employees: string;
    revenue: string;
    organization_id?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditCompanyDialog = ({ company, open, onOpenChange }: EditCompanyDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setHasUnsavedChanges, confirmNavigation } = useUnsavedChanges();
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [employees, setEmployees] = useState("");
  const [revenue, setRevenue] = useState("");

  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dirty, setDirty] = useState(false);
  // Snapshot da organização do registro carregado (hidden field). Usado
  // para validar no submit que a org ativa não mudou enquanto o usuário
  // editava — bloqueia salvar registro de outra org.
  const [recordOrgId, setRecordOrgId] = useState<string | null>(null);
  const markDirty = useCallback(() => setDirty(true), []);

  // Re-renderiza quando a org ativa muda (evento global emitido pelo
  // WorkspaceSwitcher / useOrganizations).
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => getActiveOrgId());
  useEffect(() => {
    if (!open) return;
    const sync = () => setActiveOrgIdState(getActiveOrgId());
    sync();
    window.addEventListener("lux:active-org-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lux:active-org-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [open]);

  // Quando o usuário troca de organização ativa com o modal aberto,
  // fechamos imediatamente: o registro carregado pode pertencer a outra
  // org e qualquer edição passaria a ser inválida. Mostramos um toast
  // pedindo para recarregar o registro antes de continuar.
  const initialOrgRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      initialOrgRef.current = null;
      return;
    }
    if (initialOrgRef.current === null) {
      initialOrgRef.current = activeOrgId;
      return;
    }
    if (activeOrgId !== initialOrgRef.current) {
      toast({
        title: "Organização ativa alterada",
        description:
          "O modal foi fechado para evitar edições cruzadas. Recarregue o registro na nova organização antes de continuar.",
        variant: "destructive",
      });
      setDirty(false);
      onOpenChange(false);
    }
  }, [open, activeOrgId, toast, onOpenChange]);

  const orgMismatch = useMemo(
    () => Boolean(recordOrgId && activeOrgId && recordOrgId !== activeOrgId),
    [recordOrgId, activeOrgId],
  );
  const locked = orgMismatch;

  // Validação imediata ao abrir: se a org do registro não bate com a
  // org ativa, dispara o pipeline padrão de erro (toast + banner inline +
  // audit log) ANTES de o usuário poder editar qualquer campo. Os campos
  // já ficam `disabled` via `locked`, mas o feedback explícito impede
  // qualquer ambiguidade visual.
  const validatedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !company) {
      validatedRef.current = null;
      return;
    }
    // Evita disparar o erro mais de uma vez por abertura/registro.
    const key = `${company.id}:${activeOrgId ?? ""}`;
    if (validatedRef.current === key) return;
    if (recordOrgId && activeOrgId && recordOrgId !== activeOrgId) {
      validatedRef.current = key;
      handleOrgError(
        new OrgMismatchError("companies", "update", activeOrgId, recordOrgId),
      );
    }
  }, [open, company, recordOrgId, activeOrgId]);

  useEffect(() => {
    if (company && open) {
      setName(company.name);
      setSector(company.sector === "—" ? "" : company.sector);
      setLocation(company.location === "—" ? "" : company.location);
      setEmail(company.email ?? "");
      setPhone(company.phone ?? "");
      setWebsite(company.website ?? "");
      setEmployees(company.employees === "—" ? "" : company.employees);
      setRevenue(company.revenue === "—" ? "" : company.revenue);
      setGeoStatus("idle");
      setGeoCoords(null);
      setFieldErrors({});
      setDirty(false);
      setRecordOrgId(company.organization_id ?? null);
    }
  }, [company, open]);

  // Sync local dirty flag with global guard while dialog is open
  useEffect(() => {
    setHasUnsavedChanges(open && dirty);
    return () => setHasUnsavedChanges(false);
  }, [open, dirty, setHasUnsavedChanges]);

  // Intercept dialog close to confirm if dirty
  const handleOpenChange = (next: boolean) => {
    if (!next && dirty) {
      confirmNavigation(() => {
        setDirty(false);
        onOpenChange(false);
      });
      return;
    }
    onOpenChange(next);
  };

  const geocodeLocation = async (loc: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(loc)}`,
        { headers: { "User-Agent": "LUX-IA-SalesPlatform/1.0" } }
      );
      const data = await res.json();
      if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      return null;
    } catch { return null; }
  };

  const handleLocationChange = useCallback((value: string) => {
    setLocation(value);
    setDirty(true);
    setGeoCoords(null);
    setFieldErrors((prev) => { const { location: _, ...rest } = prev; return rest; });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setGeoStatus("idle"); return; }
    setGeoStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const coords = await geocodeLocation(value.trim());
      if (coords) { setGeoStatus("found"); setGeoCoords(coords); }
      else setGeoStatus("not_found");
    }, 800);
  }, []);

  const handleSave = async () => {
    if (!company) return;

    // Defesa em profundidade: bloqueia salvar se a org do registro
    // (snapshot no load) não bate com a org ativa no momento do submit.
    const activeOrg = getActiveOrgId();
    if (recordOrgId && activeOrg && recordOrgId !== activeOrg) {
      toast({
        title: "Organização incompatível",
        description:
          "A organização ativa mudou. Recarregue o registro antes de salvar para evitar alterar dados de outra organização.",
        variant: "destructive",
      });
      return;
    }
    if (!activeOrg) {
      toast({
        title: "Organização não carregada",
        description: "Aguarde a organização ativa carregar antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    const result = validateCompany({ name, sector, location, email, phone, website, employees, revenue });
    if (!result.success) {
      setFieldErrors(result.errors);
      toast({ title: "Corrija os campos inválidos", variant: "destructive" });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const updateData: Record<string, string | number | null> = {
        name: name.trim(),
        sector: sector || null,
        location: location || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        employees: employees || null,
        revenue: revenue || null,
      };

      if (geoCoords) {
        updateData.lat = geoCoords.lat;
        updateData.lng = geoCoords.lng;
      }

      const { error } = await db.from("companies").update(updateData).eq("id", company.id);
      if (error) throw error;

      toast({ title: "Empresa atualizada!", description: `"${name}" foi atualizada com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
      queryClient.invalidateQueries({ queryKey: ["companies-map"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDirty(false);
      onOpenChange(false);
    } catch (err: unknown) {
      toast({ title: "Erro ao atualizar", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="text-[11px] text-destructive mt-0.5">{fieldErrors[field]}</p> : null;

  const clearError = (field: string) => setFieldErrors((prev) => { const { [field]: _, ...rest } = prev; return rest; });

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Empresa
          </DialogTitle>
        </DialogHeader>
        {locked && (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium">Edição bloqueada</p>
              <p className="text-xs text-destructive/90">
                Este registro pertence a outra organização. Volte para a organização
                original para editá-lo.
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input disabled={locked} value={name} onChange={(e) => { setName(e.target.value); markDirty(); clearError("name"); }} className={`mt-1 ${fieldErrors.name ? "border-destructive" : ""}`} />
            <FieldError field="name" />
          </div>
          <div>
            <Label>Setor</Label>
            <Input disabled={locked} value={sector} onChange={(e) => { setSector(e.target.value); markDirty(); clearError("sector"); }} className={`mt-1 ${fieldErrors.sector ? "border-destructive" : ""}`} />
            <FieldError field="sector" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              Localização
              {geoStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {geoStatus === "found" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              {geoStatus === "not_found" && <XCircle className="h-3 w-3 text-destructive" />}
            </Label>
            <Input disabled={locked} value={location} onChange={(e) => handleLocationChange(e.target.value)} className={`mt-1 ${fieldErrors.location ? "border-destructive" : ""}`} />
            {geoStatus === "found" && geoCoords && (
              <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1 font-mono">
                <MapPin className="h-2.5 w-2.5" />
                {geoCoords.lat.toFixed(4)}, {geoCoords.lng.toFixed(4)}
              </p>
            )}
            {geoStatus === "not_found" && (
              <p className="text-[10px] text-destructive mt-1">Localização não encontrada no mapa</p>
            )}
            <FieldError field="location" />
          </div>
          <div>
            <Label>Email</Label>
            <Input disabled={locked} type="email" value={email} onChange={(e) => { setEmail(e.target.value); markDirty(); clearError("email"); }} className={`mt-1 ${fieldErrors.email ? "border-destructive" : ""}`} />
            <FieldError field="email" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input disabled={locked} value={phone} onChange={(e) => { setPhone(e.target.value); markDirty(); clearError("phone"); }} className={`mt-1 ${fieldErrors.phone ? "border-destructive" : ""}`} />
            <FieldError field="phone" />
          </div>
          <div>
            <Label>Website</Label>
            <Input disabled={locked} value={website} onChange={(e) => { setWebsite(e.target.value); markDirty(); clearError("website"); }} className={`mt-1 ${fieldErrors.website ? "border-destructive" : ""}`} />
            <FieldError field="website" />
          </div>
          <div>
            <Label>Funcionários</Label>
            <Input disabled={locked} value={employees} onChange={(e) => { setEmployees(e.target.value); markDirty(); clearError("employees"); }} className={`mt-1 ${fieldErrors.employees ? "border-destructive" : ""}`} />
            <FieldError field="employees" />
          </div>
          <div className="col-span-2">
            <Label>Faturamento</Label>
            <Input disabled={locked} value={revenue} onChange={(e) => { setRevenue(e.target.value); markDirty(); clearError("revenue"); }} className={`mt-1 ${fieldErrors.revenue ? "border-destructive" : ""}`} />
            <FieldError field="revenue" />
          </div>
        </div>
        <Button className="w-full mt-4 gap-2" onClick={handleSave} disabled={saving || locked}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : locked ? "Edição bloqueada" : "Salvar Alterações"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
