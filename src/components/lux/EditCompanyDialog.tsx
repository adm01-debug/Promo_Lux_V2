import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Pencil, MapPin, CheckCircle2, XCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditCompanyDialog = ({ company, open, onOpenChange }: EditCompanyDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

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
    }
  }, [company, open]);

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
    setGeoCoords(null);
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
    if (!company || !name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        name: name.trim(),
        sector: sector || null,
        location: location || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        employees: employees || null,
        revenue: revenue || null,
      };

      // Only update coords if location changed and we have new coords
      if (geoCoords) {
        updateData.lat = geoCoords.lat;
        updateData.lng = geoCoords.lng;
      }

      const { error } = await supabase.from("companies").update(updateData).eq("id", company.id);
      if (error) throw error;

      toast({ title: "Empresa atualizada!", description: `"${name}" foi atualizada com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
      queryClient.invalidateQueries({ queryKey: ["companies-map"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Empresa
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Setor</Label>
            <Input value={sector} onChange={(e) => setSector(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              Localização
              {geoStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {geoStatus === "found" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              {geoStatus === "not_found" && <XCircle className="h-3 w-3 text-destructive" />}
            </Label>
            <Input value={location} onChange={(e) => handleLocationChange(e.target.value)} className="mt-1" />
            {geoStatus === "found" && geoCoords && (
              <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1 font-mono">
                <MapPin className="h-2.5 w-2.5" />
                {geoCoords.lat.toFixed(4)}, {geoCoords.lng.toFixed(4)}
              </p>
            )}
            {geoStatus === "not_found" && (
              <p className="text-[10px] text-destructive mt-1">Localização não encontrada no mapa</p>
            )}
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Funcionários</Label>
            <Input value={employees} onChange={(e) => setEmployees(e.target.value)} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label>Faturamento</Label>
            <Input value={revenue} onChange={(e) => setRevenue(e.target.value)} className="mt-1" />
          </div>
        </div>
        <Button className="w-full mt-4 gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
