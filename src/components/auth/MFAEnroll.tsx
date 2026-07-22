import { useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Shield, Copy, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
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
      toast({ title: "MFA ativado com sucesso!", description: "Sua conta agora exige verificaÃ§Ã£o em 2 etapas." });
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
            <Shield className="h-5 w-5 text-blue-600" />
            <CardTitle>Ativar AutenticaÃ§Ã£o em 2 Fatores</CardTitle>
          </div>
          <CardDescription>Adicione uma camada extra de seguranÃ§a com um aplicativo autenticador.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>âœ‰ Protege sua conta mesmo se sua senha for comprometida</p>
            <p>âœ‰ Funciona sem internet no seu dispositivo</p>
            <p>âœ‰ CompatÃ­vel com qualquer app TOTP (Google, Authy, 1Password)</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleStartEnroll} disabled={loading} className="flex-1">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Configurar agora
            </Button>
            {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "scan" && enrollData) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
            Escanear QR Code
          </CardTitle>
          <CardDescription>Abra o aplicativo autenticador e escaneie o QR code abaixo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="border rounded-lg p-3 bg-white" dangerouslySetInnerHTML={{ __html: enrollData.totp.qr_code }} style={{ width: 200, height: 200 }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ou insira a chave manualmente:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">{enrollData.totp.secret}</code>
              <Button variant="ghost" size="icon" onClick={copySecret}>
                {secretCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-›qÜ´Ðˆ€¼ùô(€€€€€€€€€€€€€€ð½	ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ	ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑMÑ•À ‰Ù•É¥™äˆ¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°ˆø(€€€€€€€€€€€+„•Í…¹•¥•¤€˜ŒàÈÄÐìY•É¥™¥…ÈÍ‘¥¼(€€€€€€€€€€ð½	ÕÑÑ½¸ø(€€€€€€€€ð½…É‘½¹Ñ•¹Ðø(€€€€€€ð½…Éø(€€€€¤ì(€ô((€¥˜€¡ÍÑ•À€ôôô€‰Ù•É¥™äˆ¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñ…É±…ÍÍ9…µ”ô‰Üµ™Õ±°µ…àµÜµµˆø(€€€€€€€€ñ…É‘!•…‘•Èø(€€€€€€€€€€ñ…É‘Q¥Ñ±”±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™±•à ´ØÜ´Ø¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÉ½Õ¹‘•µ™Õ±°‰œµ‰±Õ”´ÄÀÀÑ•áÐµ‰±Õ”´ØÀÀÑ•áÐµáÌ™½¹Ðµ‰½±ˆøÈð½ÍÁ…¸ø(€€€€€€€€€€€Y•É¥™¥…ÈÍ‘¥¼(€€€€€€€€€€ð½…É‘Q¥Ñ±”ø(€€€€€€€€€€ñ…É‘•ÍÉ¥ÁÑ¥½¸ù%¹Í¥É„¼Í‘¥¼‘”€Ø“µ¥Ñ½Ì•á¥‰¥‘¼¹¼…Á±¥…Ñ¥Ù¼…ÕÑ•¹Ñ¥…‘½È¸ð½…É‘•ÍÉ¥ÁÑ¥½¸ø(€€€€€€€€ð½…É‘!•…‘•Èø(€€€€€€€€ñ…É‘½¹Ñ•¹Ð±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ðˆø(€€€€€€€€€í•ÉÉ½È€˜˜€ (€€€€€€€€€€€€ñ±•ÉÐÙ…É¥…¹Ðô‰‘•ÍÑÉÕÑ¥Ù”ˆø(€€€€€€€€€€€€€€ñ±•ÉÑ¥É±”±…ÍÍ9…µ”ô‰ ´ÐÜ´Ðˆ€¼ø(€€€€€€€€€€€€€€ñ±•ÉÑ•ÍÉ¥ÁÑ¥½¸ùí•ÉÉ½Éôð½±•ÉÑ•ÍÉ¥ÁÑ¥½¸ø(€€€€€€€€€€€€ð½±•ÉÐø(€€€€€€€€€€¥ô(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ•¹Ñ•Èˆø(€€€€€€€€€€€€ñ%¹ÁÕÑ=Q@µ…á1•¹Ñ õìÙôÙ…±Õ”õí½‘•ô½¹¡…¹”õíÍ•Ñ½‘•ô…ÕÑ½½ÕÌø(€€€€€€€€€€€€€€ñ%¹ÁÕÑ=QAÉ½ÕÀø(€€€€€€€€€€€€€€€ílÀ°€Ä°€È°€Ì°€Ð°€Õt¹µ…À ¡¤¤€ôø€ñ%¹ÁÕÑ=QAM±½Ð­•äõí¥ô¥¹‘•àõí¥ô€¼ø¥ô(€€€€€€€€€€€€€€ð½%¹ÁÕÑ=QAÉ½ÕÀø(€€€€€€€€€€€€ð½%¹ÁÕÑ=Q@ø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ	ÕÑÑ½¸½¹±¥¬õí¡…¹‘±•Y•É¥™åô‘¥Í…‰±•õí±½…‘¥¹œñð½‘”¹±•¹Ñ €„ôô€Ùô±…ÍÍ9…µ”ô‰Üµ™Õ±°ˆø(€€€€€€€€€€€í±½…‘¥¹œ€ü€ñI•™É•Í¡Ü±…ÍÍ9…µ”ô‰ ´ÐÜ´Ð…¹¥µ…Ñ”µÍÁ¥¸µÈ´Èˆ€¼ø€è¹Õ±±ô(€€€€€€€€€€€½¹™¥Éµ…È”…Ñ¥Ù…È5(€€€€€€€€€€ð½	ÕÑÑ½¸ø(€€€€€€€€€€ñ	ÕÑÑ½¸Ù…É¥…¹Ðô‰¡½ÍÐˆÍ¥é”ô‰Í´ˆ½¹±¥¬õì ¤€ôøÍ•ÑMÑ•À ‰Í…¸ˆ¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°ˆûŠ@Y½±Ñ…È…¼EH½‘”ð½	ÕÑÑ½¸ø(€€€€€€€€ð½…É‘½¹Ñ•¹Ðø(€€€€€€ð½…Éø(€€€€¤ì(€ô((€É•ÑÕÉ¸€ (€€€€ñ…É±…ÍÍ9…µ”ô‰Üµ™Õ±°µ…àµÜµµˆø(€€€€€€ñ…É‘½¹Ñ•¹Ð±…ÍÍ9…µ”ô‰ÁÐ´àÁˆ´ØÑ•áÐµ•¹Ñ•ÈÍÁ…”µä´Ìˆø(€€€€€€€€ñ¡•­¥É±”È±…ÍÍ9…µ”ô‰ ´ÄÈÜ´ÄÈÑ•áÐµÉ••¸´ÔÀÀµàµ…ÕÑ¼ˆ€¼ø(€€€€€€€€ñ Ì±…ÍÍ9…µ”ô‰Ñ•áÐµ±œ™½¹ÐµÍ•µ¥‰½±ˆù5…Ñ¥Ù…‘¼„ð½ Ìø(€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´Ñ•áÐµµÕÑ•µ™½É•É½Õ¹ˆùMÕ„½¹Ñ„…½É„É•ÅÕ•ÈÙ•É¥™¥‡Ÿ¼•´€È•Ñ…Á…Ì…¼™…é•È±½¥¸¸ð½Àø(€€€€€€€€ñ	…‘”Ù…É¥…¹Ðô‰Í•½¹‘…Éäˆ±…ÍÍ9…µ”ô‰Ñ•áÐµÉ••¸´ÜÀÀ‰œµÉ••¸´ÄÀÀˆù;µÙ•°‘”Í•ÕÉ…»„è±Ñ¼€¡0È¤ð½	…‘”ø(€€€€€€ð½…É‘½¹Ñ•¹Ðø(€€€€ð½…Éø(€€¤ì)ô(base64: invalid input
