import { useState, useRef, useCallback } from "react";
import { Plus, Loader2, Building2, MapPin, CheckCircle2, XCircle, Sparkles, Users, Briefcase, Home } from "lucide-react";
import type { CnpjPartner, CnpjActivity } from "@/hooks/useCnpjEnrich";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { validateCompany } from "@/lib/schemas/company";
import { useCnpjEnrich } from "@/hooks/useCnpjEnrich";
import { useCnpjAutoEnrichSetting } from "@/hooks/useCnpjAutoEnrichSetting";

type GeoStatus = "idle" | "checking" | "found" | "not_found";

export const AddCompanyDialog = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [employees, setEmployees] = useState("");
  const [revenue, setRevenue] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [cnaeCode, setCnaeCode] = useState<string | null>(null);
  const [members, setMembers] = useState<CnpjPartner[]>([]);
  const [sideActivities, setSideActivities] = useState<CnpjActivity[]>([]);

  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cnpjDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status: cnpjStatus, enrich: enrichCnpj, reset: resetCnpjEnrich } = useCnpjEnrich();
  const { enabled: autoEnrichEnabled } = useCnpjAutoEnrichSetting();

  const reset = () => {
    setName(""); setCnpj(""); setSector(""); setLocation(""); setEmail("");
    setPhone(""); setWebsite(""); setLinkedinUrl(""); setInstagramUrl("");
    setEmployees(""); setRevenue(""); setDescription("");
    setAddress(""); setCnaeCode(null); setMembers([]); setSideActivities([]);
    setGeoStatus("idle"); setGeoCoords(null); setFieldErrors({});
    resetCnpjEnrich();
  };

  const geocodeLocation = async (loc: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(loc)}`,
        { headers: { "User-Agent": "LUX-IA-SalesPlatform/1.0" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleLocationChange = useCallback((value: string) => {
    setLocation(value);
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

  const handleCnpjChange = useCallback((value: string) => {
    setCnpj(value);
    setFieldErrors((prev) => { const { cnpj: _, ...rest } = prev; return rest; });
    if (cnpjDebounceRef.current) clearTimeout(cnpjDebounceRef.current);
    const digits = value.replace(/\D+/g, "");
    if (digits.length !== 14) { resetCnpjEnrich(); return; }
    if (!autoEnrichEnabled) { resetCnpjEnrich(); return; }
    cnpjDebounceRef.current = setTimeout(async () => {
      const enriched = await enrichCnpj(digits);
      if (!enriched) return;
      // Auto-preencher apenas campos vazios (não sobrescreve edição do usuário).
      if (enriched.name && !name.trim()) setName(enriched.name);
      if (enriched.sector && !sector.trim()) {
        setSector(enriched.cnae_code ? `${enriched.sector} (CNAE ${enriched.cnae_code})` : enriched.sector);
      }
      if (enriched.location && !location.trim()) {
        handleLocationChange(enriched.location);
      }
      if (enriched.email && !email.trim()) setEmail(enriched.email);
      if (enriched.phone && !phone.trim()) setPhone(enriched.phone);
      if (enriched.size && !employees.trim()) setEmployees(enriched.size);
      if (enriched.address) setAddress(enriched.address);
      setCnaeCode(enriched.cnae_code);
      setMembers(enriched.members ?? []);
      setSideActivities(enriched.activities_full ?? []);
      // Compõe uma descrição estruturada apenas se o usuário ainda não digitou nada.
      if (!description.trim()) {
        const parts: string[] = [];
        if (enriched.alias && enriched.alias !== enriched.name) parts.push(`Nome fantasia: ${enriched.alias}`);
        if (enriched.status) parts.push(`Situação: ${enriched.status}`);
        if (enriched.founded) parts.push(`Fundada em ${enriched.founded}`);
        if (enriched.address) parts.push(`Endereço: ${enriched.address}`);
        if (enriched.cnae_code || enriched.cnae_text) {
          parts.push(`CNAE principal: ${[enriched.cnae_code, enriched.cnae_text].filter(Boolean).join(" - ")}`);
        }
        if ((enriched.members ?? []).length > 0) {
          const socios = enriched.members
            .slice(0, 5)
            .map((m) => (m.role ? `${m.name} (${m.role})` : m.name))
            .join("; ");
          parts.push(`Sócios: ${socios}${enriched.members.length > 5 ? " …" : ""}`);
        }
        if (parts.length) setDescription(parts.join(" • "));
      }
      toast({
        title: "Empresa encontrada!",
        description: `Dados de "${enriched.name ?? enriched.cnpj}" preenchidos automaticamente.`,
      });
    }, 600);
  }, [enrichCnpj, resetCnpjEnrich, name, sector, location, email, phone, employees, description, handleLocationChange, toast]);


  const handleSave = async () => {
    const result = validateCompany({ name, cnpj, sector, location, email, phone, website, linkedin_url: linkedinUrl, instagram_url: instagramUrl, employees, revenue, description });
    if (!result.success) {
      setFieldErrors(result.errors);
      toast({ title: "Corrija os campos inválidos", variant: "destructive" });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const { error } = await db.from("companies").insert([{
        name: name.trim(),
        cnpj: result.data.cnpj || null,
        sector: sector || null,
        location: location || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        linkedin_url: linkedinUrl || null,
        instagram_url: instagramUrl || null,
        employees: employees || null,
        revenue: revenue ? parseFloat(revenue.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
        description: description || null,
        source: "manual",
        lat: geoCoords?.lat ?? null,
        lng: geoCoords?.lng ?? null,
      }]);
      if (error) throw error;

      const geoMsg = geoCoords ? " Coordenadas detectadas automaticamente." : location ? " Não foi possível geocodificar a localização." : "";
      toast({ title: "Empresa adicionada!", description: `"${name}" foi criada com sucesso.${geoMsg}` });
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
      queryClient.invalidateQueries({ queryKey: ["companies-map"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      reset();
      setOpen(false);
    } catch (err: unknown) {
      toast({ title: "Erro ao criar empresa", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="text-[11px] text-destructive mt-0.5">{fieldErrors[field]}</p> : null;

  const clearError = (field: string) => setFieldErrors((prev) => { const { [field]: _, ...rest } = prev; return rest; });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 text-sm">
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Nova Empresa
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2 sm:col-span-1">
            <Label>Nome *</Label>
            <Input placeholder="Nome da empresa" value={name} onChange={(e) => { setName(e.target.value); clearError("name"); }} className={`mt-1 ${fieldErrors.name ? "border-destructive" : ""}`} />
            <FieldError field="name" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="flex items-center gap-1.5">
              CNPJ
              {cnpjStatus === "loading" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {cnpjStatus === "success" && <Sparkles className="h-3 w-3 text-primary" />}
              {cnpjStatus === "not_found" && <XCircle className="h-3 w-3 text-destructive" />}
            </Label>
            <Input
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => handleCnpjChange(e.target.value)}
              className={`mt-1 ${fieldErrors.cnpj ? "border-destructive" : ""}`}
            />
            {cnpjStatus === "loading" && (
              <p className="text-[10px] text-muted-foreground mt-1">Buscando dados no CNPJá…</p>
            )}
            {cnpjStatus === "success" && (
              <p className="text-[10px] text-primary mt-1">Dados preenchidos automaticamente.</p>
            )}
            {cnpjStatus === "not_found" && (
              <p className="text-[10px] text-destructive mt-1">CNPJ não encontrado na base pública.</p>
            )}
            <FieldError field="cnpj" />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Label>Setor</Label>
            <Input placeholder="Ex: SaaS B2B" value={sector} onChange={(e) => { setSector(e.target.value); clearError("sector"); }} className={`mt-1 ${fieldErrors.sector ? "border-destructive" : ""}`} />
            <FieldError field="sector" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="flex items-center gap-1.5">
              Localização
              {geoStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {geoStatus === "found" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              {geoStatus === "not_found" && <XCircle className="h-3 w-3 text-destructive" />}
            </Label>
            <Input placeholder="Ex: São Paulo - SP" value={location} onChange={(e) => handleLocationChange(e.target.value)} className={`mt-1 ${fieldErrors.location ? "border-destructive" : ""}`} />
            {geoStatus === "found" && geoCoords && (
              <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1 font-mono">
                <MapPin className="h-2.5 w-2.5" />
                {geoCoords.lat.toFixed(4)}, {geoCoords.lng.toFixed(4)}
              </p>
            )}
            <FieldError field="location" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Email</Label>
            <Input type="email" placeholder="contato@empresa.com" value={email} onChange={(e) => { setEmail(e.target.value); clearError("email"); }} className={`mt-1 ${fieldErrors.email ? "border-destructive" : ""}`} />
            <FieldError field="email" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Telefone</Label>
            <Input placeholder="(11) 99999-9999" value={phone} onChange={(e) => { setPhone(e.target.value); clearError("phone"); }} className={`mt-1 ${fieldErrors.phone ? "border-destructive" : ""}`} />
            <FieldError field="phone" />
          </div>
          <div className="col-span-2">
            <Label>Website</Label>
            <Input placeholder="https://empresa.com" value={website} onChange={(e) => { setWebsite(e.target.value); clearError("website"); }} className={`mt-1 ${fieldErrors.website ? "border-destructive" : ""}`} />
            <FieldError field="website" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>LinkedIn</Label>
            <Input placeholder="https://linkedin.com/company/..." value={linkedinUrl} onChange={(e) => { setLinkedinUrl(e.target.value); clearError("linkedin_url"); }} className={`mt-1 ${fieldErrors.linkedin_url ? "border-destructive" : ""}`} />
            <FieldError field="linkedin_url" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Instagram</Label>
            <Input placeholder="https://instagram.com/..." value={instagramUrl} onChange={(e) => { setInstagramUrl(e.target.value); clearError("instagram_url"); }} className={`mt-1 ${fieldErrors.instagram_url ? "border-destructive" : ""}`} />
            <FieldError field="instagram_url" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Funcionários</Label>
            <Input placeholder="Ex: 50-200" value={employees} onChange={(e) => { setEmployees(e.target.value); clearError("employees"); }} className={`mt-1 ${fieldErrors.employees ? "border-destructive" : ""}`} />
            <FieldError field="employees" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Faturamento</Label>
            <Input placeholder="Ex: R$ 1M - 5M" value={revenue} onChange={(e) => { setRevenue(e.target.value); clearError("revenue"); }} className={`mt-1 ${fieldErrors.revenue ? "border-destructive" : ""}`} />
            <FieldError field="revenue" />
          </div>
          <div className="col-span-2">
            <Label className="flex items-center gap-1.5">
              <Home className="h-3 w-3 text-muted-foreground" />
              Endereço
            </Label>
            <Input
              placeholder="Rua, número, bairro, cidade - UF, CEP"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
            />
            {address && cnpjStatus === "success" && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Preenchido automaticamente a partir do CNPJ. Edite se necessário.</p>
            )}
          </div>

          {(cnaeCode || sideActivities.length > 0 || members.length > 0) && (
            <div className="col-span-2 rounded-md border border-border/60 bg-muted/30 p-3 space-y-3">
              {(cnaeCode || sideActivities.length > 0) && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Briefcase className="h-3 w-3 text-primary" />
                    CNAE
                  </div>
                  {cnaeCode && (
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono">Principal: {cnaeCode}</p>
                  )}
                  {sideActivities.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {sideActivities.slice(0, 4).map((a, i) => (
                        <li key={`${a.code ?? "cnae"}-${i}`} className="text-[11px] text-muted-foreground">
                          <span className="font-mono">{a.code ?? "—"}</span>
                          {a.text && <span> — {a.text}</span>}
                        </li>
                      ))}
                      {sideActivities.length > 4 && (
                        <li className="text-[10px] text-muted-foreground/70">+{sideActivities.length - 4} atividades secundárias</li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              {members.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Users className="h-3 w-3 text-primary" />
                    Sócios ({members.length})
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {members.slice(0, 5).map((m, i) => (
                      <li key={`${m.name ?? "socio"}-${i}`} className="text-[11px] text-muted-foreground flex items-baseline gap-1.5">
                        <span className="text-foreground">{m.name}</span>
                        {m.role && <span className="text-[10px]">— {m.role}</span>}
                      </li>
                    ))}
                    {members.length > 5 && (
                      <li className="text-[10px] text-muted-foreground/70">+{members.length - 5} outros sócios</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="col-span-2">
            <Label>Descrição</Label>
            <Input placeholder="Breve resumo sobre a empresa..." value={description} onChange={(e) => { setDescription(e.target.value); clearError("description"); }} className={`mt-1 ${fieldErrors.description ? "border-destructive" : ""}`} />
            <FieldError field="description" />
          </div>
        </div>
        <Button className="w-full mt-4 gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {saving ? "Salvando..." : "Adicionar Empresa"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
