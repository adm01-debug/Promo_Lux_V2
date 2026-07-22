import { useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { useMFA } from "@/hooks/useMFA";

interface MFAVerifyProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * MFAVerify -- usado no fluxo de login quando o usuÃ¡rio tem TOTP ativo.
 * Difere do MFAEnroll: aqui nÃ£o cadastramos -- apenas verificamos o cÃ³digo.
 * Usar apÃ³s authenticationLevel.requiredLevel === 'aal2' detectar seÍ necessÃ¡rio.
 */
export function MFAVerify({ onSuccess, onCancel }: MFAVerifyProps) {
  const { verify, factors, loading, error } = useMFA();
  const [code, setCode] = useState("");

  // Usar o primeiro fator TOTP verificado
  const activeFactor = factors.find(f => f.status === "verified");

  const handleVerify = async () => {
    if (!activeFactor || code.length !== 6) return;
    const ok = await verify(activeFactor.id, code);
    if (ok) onSuccess?.();
  };

  // Disparar verificaÃ§Ã£o ao completar 6 dÃ­gitos
  const handleCodeChange = (value: string) => {
    setCode(value);
    if (value.length === 6) {
      // Auto-submit aos 6 dÃ­gitos
      if (activeFactor) {
        verify(activeFactor.id, value).then(ok => { if (ok) onSuccess?.(); });
      }
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-›qÜ´ÔÑ•áÐµ‰±Õ”´ØÀÀˆ€¼ø(€€€€€€€€€€ñ…É‘Q¥Ñ±”ùY•É¥™¥‡Ÿ¼•´€È•Ñ…Á…Ìð½…É‘Q¥Ñ±”ø(€€€€€€€€ð½‘¥Øø(€€€€€€€€ñ…É‘•ÍÉ¥ÁÑ¥½¸ø(€€€€€€€€€í…Ñ¥Ù•…Ñ½È(€€€€€€€€€€€€ü%¹Í¥É„¼Í‘¥¼‘¼…ÕÑ•¹Ñ¥…‘½È€‘í…Ñ¥Ù•…Ñ½È¹™É¥•¹‘±å}¹…µ”ñð€‰Q=Q@‰ô¹€(€€€€€€€€€€€€è€‰9•¹¡Õ´™…Ñ½È5Y•¹½¹ÑÉ…‘¼¸½¹™¥ÕÉ”¼5¹…Ì½¹™¥ÕÉ‡ŸÕ•Ì¸‰ô(€€€€€€€€ð½…É‘•ÍÉ¥ÁÑ¥½¸ø(€€€€€€ð½…É‘!•…‘•Èø(€€€€€€ñ…É‘½¹Ñ•¹Ð±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ðˆø(€€€€€€€í•ÉÉ½È€˜˜€ (€€€€€€€€€€ñ±•ÉÐÙ…É¥…¹Ðô‰‘•ÍÑÉÕÑ¥Ù”ˆø(€€€€€€€€€€€€ñ±•ÉÑ¥É±”±…ÍÍ9…µ”ô‰ ´ÐÜ´Ðˆ€¼ø(€€€€€€€€€€€€ñ±•ÉÑ•ÍÉ¥ÁÑ¥½¸ùí•ÉÉ½Éôð½±•ÉÑ•ÍÉ¥ÁÑ¥½¸ø(€€€€€€€€€€ð½±•ÉÐø(€€€€€€€€¥ô((€€€€€€€í…Ñ¥Ù•…Ñ½È€˜˜€ (€€€€€€€€€€ðø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€ñ%¹ÁÕÑ=Q@(€€€€€€€€€€€€€€€µ…á1•¹Ñ õìÙô(€€€€€€€€€€€€€€€Ù…±Õ”õí½‘•ô(€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•½‘•¡…¹•ô(€€€€€€€€€€€€€€€…ÕÑ½½ÕÌ(€€€€€€€€€€€€€€€‘¥Í…‰±•õí±½…‘¥¹ô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñ%¹ÁÕÑ=QAÉ½ÕÀø(€€€€€€€€€€€€€€€€€ílÀ°€Ä°€È°€Ì°€Ð°€Õt¹µ…À ¡¤¤€ôø€ (€€€€€€€€€€€€€€€€€€€€ñ%¹ÁÕÑ=QAM±½Ð­•äõí¥ô¥¹‘•àõí¥ô€¼ø(€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€ð½%¹ÁÕÑ=QAÉ½ÕÀø(€€€€€€€€€€€€€€ð½%¹ÁÕÑ=Q@ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€í±½…‘¥¹œ€˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€ñI•™É•Í¡Ü±…ÍÍ9…µ”ô‰ ¶mÇrÓRæ–ÖFR×7–âFW‡BÖ×WFVBÖf÷&Vw&÷VæB"óà¢ÂöF—cà¢—Ð ¢Ä'WGFöà¢öä6Æ–6³×¶†æFÆUfW&–g—Ð¢F—6&ÆVC×¶ÆöF–ærÇÂ6öFRæÆVæwF‚ÓÒgÐ¢6Æ74æÖSÒ'rÖgVÆÂ ¢à¢fW&–f–6 ¢Âô'WGFöãà¢Âóà¢—Ð ¢¶öä6æ6VÂbb€¢Ä'WGFöâf&–çCÒ&v†÷7B"6—¦SÒ'6Ò"öä6Æ–6³×¶öä6æ6VÇÒ6Æ74æÖSÒ'rÖgVÆÂ#à¢6æ6VÆ ¢Âô'WGFöãà¢—Ð¢Âô6&D6öçFVçCà¢Âô6&Cà¢“°§Ðbase64: invalid input
