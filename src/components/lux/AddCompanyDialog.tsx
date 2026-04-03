import { useState } from "react";
import { Plus, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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

  const reset = () => {
    setName(""); setSector(""); setLocation(""); setEmail("");
    setPhone(""); setWebsite(""); setEmployees(""); setRevenue("");
  };

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
      });
      if (error) throw error;
      toast({ title: "Empresa adicionada!", description: `"${name}" foi criada com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["companies-list"] });
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
            <Label>Localização</Label>
            <Input placeholder="Ex: São Paulo - SP" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" />
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
