import { useState } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useMFA, type MFAEnrollData } from "@/hooks/useMFA";
import { useToast } from "@/hooks/use-toast";

interface MFAEnrollProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type Step = "start" | "scan" | "verify" | "done";

export function MFAEnroll({ onSuccess, onCancel }: MFAEnrollProps) {
  const { enroll, verify, loading, error } = useMFA();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("start");
  const [enrollData, setEnrollData] = useState<MFAEnrollData | null>(null);
  const [code, setCode] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);

  const handleStartEnroll = async () => {
    const data = await enroll("Autenticador LUX IA");
    if (data) {
      setEnrollData(data);
      setStep("scan");
    }
  };

  const handleVerify = async () => {
    if (!enrollData || code.length !== 6) return;
    const ok = await verify(enrollData.id, code);
    if (ok) {
      setStep("done");
      toast({
        title: "MFA ativado com sucesso!",
        description: "Sua conta agora exige verificação em 2 etapas.",
      });
      setTimeout(() => onSuccess?.(), 1500);
    }
  };

  const copySecret = async () => {
    if (!enrollData?.totp.secret) return;
    await navigator.clipboard.writeText(enrollData.totp.secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  if (step === "start") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Ativar Autenticação em 2 Fatores</CardTitle>
          </div>
          <CardDescription>
            Adicione uma camada extra de segurança com um aplicativo
            autenticador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Protege sua conta mesmo se a senha for comprometida</p>
            <p>• Funciona sem internet no dispositivo</p>
            <p>• Compatível com qualquer app TOTP (Google, Authy, 1Password)</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleStartEnroll}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Configurar agora
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if ((step === "scan" || step === "verify") && enrollData) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              1
            </span>
            Escanear QR Code
          </CardTitle>
          <CardDescription>
            Abra o app autenticador e escaneie o QR code abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div
              className="border rounded-lg p-3 bg-white"
              dangerouslySetInnerHTML={{ __html: enrollData.totp.qr_code }}
              style={{ width: 200, height: 200 }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Ou insira a chave manualmente:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                {enrollData.totp.secret}
              </code>
              <Button variant="ghost" size="icon" onClick={copySecret}>
                {secretCopied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Digite o código de 6 dígitos:</p>
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="flex-1"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmar
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-8">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="text-lg font-semibold">MFA ativado!</p>
        <p className="text-sm text-muted-foreground">
          Sua conta está protegida.
        </p>
      </CardContent>
    </Card>
  );
}
