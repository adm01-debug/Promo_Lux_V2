import { useState, useEffect } from "react";
import { Shield, ShieldAlert, ShieldCheck, Loader2, Key, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MFAFactor {
  id: string;
  status: string;
  factor_type?: string;
  friendly_name?: string | null;
}

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const MFASetup = () => {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [copied, setCopied] = useState(false);

  const fetchFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.error("Error listing factors", error);
      return;
    }
    setFactors(data.all || []);
  };

  useEffect(() => {
    fetchFactors();
  }, []);

  const startEnrollment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: unknown) {
      toast({ title: "Erro", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!factorId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      
      const challengeId = data.id;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;
      
      toast({ title: "MFA Ativado!", description: "Sua conta está agora mais protegida." });
      setFactorId(null);
      setVerifyCode("");
      fetchFactors();
    } catch (err: unknown) {
      toast({ title: "Erro na verificação", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const unenroll = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast({ title: "MFA Desativado", description: "O fator de autenticação foi removido." });
      fetchFactors();
    } catch (err: unknown) {
      toast({ title: "Erro ao desativar", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const activeMFA = factors.find(f => f.status === "verified");

  if (activeMFA) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-success/5 border border-success/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Autenticação de Dois Fatores Ativa</p>
              <p className="text-xs text-muted-foreground">Sua conta está protegida por TOTP (Google Authenticator, etc.)</p>
            </div>
          </div>
          <Badge className="bg-success/20 text-success hover:bg-success/20 border-success/30">Ativo</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => unenroll(activeMFA.id)} disabled={loading} className="text-destructive hover:text-destructive gap-2">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3" />}
          Desativar MFA
        </Button>
      </div>
    );
  }

  if (factorId) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        <div className="p-4 rounded-lg bg-secondary/30 border border-border/20 space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" /> Configurar TOTP
          </h4>
          <p className="text-xs text-muted-foreground">
            Escaneie o QR Code abaixo com seu app de autenticação (Google Authenticator, Authy, etc.) ou insira o código manualmente.
          </p>
          
          <div className="flex justify-center p-2 bg-white rounded-lg inline-block mx-auto">
            {qrCode && <img src={qrCode} alt="MFA QR Code" className="w-40 h-40" />}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase">Código Secreto</Label>
            <div className="flex gap-2">
              <Input value={secret || ""} readOnly className="h-8 text-xs font-mono" />
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => {
                navigator.clipboard.writeText(secret || "");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}>
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-xs font-medium">Digite o código de 6 dígitos para confirmar:</Label>
            <div className="flex gap-2">
              <Input 
                value={verifyCode} 
                onChange={e => setVerifyCode(e.target.value)} 
                placeholder="000000" 
                maxLength={6}
                className="h-10 text-center text-lg tracking-[0.5em] font-mono"
              />
              <Button onClick={verifyEnrollment} disabled={loading || verifyCode.length < 6} className="h-10">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar"}
              </Button>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => setFactorId(null)} className="w-full text-xs opacity-60">
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30 border border-border/20">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Segurança de Dois Fatores (MFA)</p>
          <p className="text-xs text-muted-foreground">Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador.</p>
        </div>
      </div>
      <Button onClick={startEnrollment} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
        Configurar MFA
      </Button>
    </div>
  );
};
