import { ArrowLeft, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailInput } from "./EmailInput";

interface ForgotPasswordOverlayProps {
  resetEmail: string;
  onResetEmailChange: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isSubmitting: boolean;
  disabled: boolean;
}

export function ForgotPasswordOverlay({
  resetEmail,
  onResetEmailChange,
  onSubmit,
  onBack,
  isSubmitting,
  disabled,
}: ForgotPasswordOverlayProps) {
  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-2xl p-8 flex flex-col justify-center space-y-4 z-10">
      <button
        type="button"
        onClick={onBack}
        className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Voltar ao login"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-foreground">Redefinir senha</h2>
        <p className="text-xs text-muted-foreground">
          Enviaremos um link para redefinir sua senha.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <EmailInput
          id="reset-email"
          value={resetEmail}
          onChange={onResetEmailChange}
          autoFocus
        />
        <Button
          type="submit"
          disabled={disabled || isSubmitting}
          className="w-full gap-2"
          size="lg"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Enviar link
        </Button>
      </form>
    </div>
  );
}
