import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Loader2, Building2, MapPin, CheckCircle2, XCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type GeoStatus = "idle" | "checking" | "found" | "not_found";

export const AddCompanyDialog = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
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

  const reset = () => {
    setName(""); setSector(""); setLocation(""); setEmail("");
    setPhone(""); setWebsite(""); setEmployees(""); setRevenue("");
    setGeoStatus("idle"); setGeoCoords(null);
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

  // Debounced geocode on location change
  const handleLocationChange = useCallback((value: string) => {
    setLocation(value);
    setGeoCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setGeoStatus("idle");
      return;
    }
    setGeoStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const coords = await geocodeLocation(value.trim());
      if (coords) {
        setGeoStatus("found");
        setGeoCoords(coords);
      } else {
        setGeoStatus("not_found");
      }
    }, 800);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("companies").insert({
        name: name.trim(),
        sector: sector || null,
        location: location || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        employees: employees || null,
        revenue: revenue || null,
        source: "manual",
        lat: geoCoords?.lat ?? null,
        lng: geoCoords?.lng ?? null,
      });
      if (error) throw error;

      const geoMsg = geoCoords ? " Coordenadas detectadas automaticamente." : location ? " Não foi possível geocodificar a localização." : "";
      toast({ title: "Empresa adicionada!", description: `"${name}" foi criada com sucesso.${geoMsg}` });
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
      queryClient.invalidateQueries({ queryKey: ["companies-map"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      reset();
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao criar empresa", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input placeholder="Nome da empresa" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Setor</Label>
            <Input placeholder="Ex: SaaS B2B" value={sector} onChange={(e) => setSector(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              Localização
              {geoStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {geoStatus === "found" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              {geoStatus === "not_found" && <XCircle className="h-3 w-3 text-destructive" />}
            </Label>
            <Input placeholder="Ex: São Paulo - SP" value={location} onChange={(e) => handleLocationChange(e.target.value)} className="mt-1" />
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
            <Input type="email" placeholder="contato@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Website</Label>
            <Input placeholder="https://empresa.com" value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Funcionários</Label>
            <Input placeholder="Ex: 50-200" value={employees} onChange={(e) => setEmployees(e.target.value)} className="mt-1" />
          </div>
          <div className="col-span-2">
            <Label>Faturamento</Label>
            <Input placeholder="Ex: R$ 1M - 5M" value={revenue} onChange={(e) => setRevenue(e.target.value)} className="mt-1" />
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
