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
import { ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { useMFA } from "@/hooks/useMFA";

interface MFAVerifyProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * MFAVerify — usado no fluxo de login quando o usuário tem TOTP ativo.
 * Difere do MFAEnroll: aqui não cadastramos, apenas verificamos o código.
 */
export function MFAVerify({ onSuccess, onCancel }: MFAVerifyProps) {
  const { factors, verify, loading, error } = useMFA();
  const [code, setCode] = useState("");

  const activeFactor = factors.find((f) => f.status === "verified");

  const handleVerify = async () => {
    if (!activeFactor || code.length !== 6) return;
    const ok = await verify(activeFactor.id, code);
    if (ok) onSuccess?.();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Verificação em 2 Etapas</CardTitle>
        </div>
        <CardDescription>
          Digite o código de 6 dígitos do seu app autenticador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <InputOTP maxLength={6} value={code} onChange={setCode}>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
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
            Verificar
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
