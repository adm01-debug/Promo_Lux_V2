import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Eye, LogIn, ArrowLeft } from "lucide-react";

interface DemoNoticeProps {
  /** Nome da área exibido na mensagem (ex.: "Análises"). */
  area: string;
  /** Ação de voltar para o painel, quando o layout oferece navegação. */
  onBack?: () => void;
  /** Ação de criar conta; por padrão leva para a tela de login. */
  onSignUp?: () => void;
}

/**
 * Aviso usado nas telas que não têm dados de demonstração: explica por que a
 * área está vazia e oferece o caminho para sair da demonstração, sem bloquear
 * a navegação.
 */
export const DemoNotice = ({ area, onBack, onSignUp }: DemoNoticeProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
    role="status"
  >
    <div className="relative mb-6">
      <div className="absolute -inset-4 rounded-3xl border border-primary/10" aria-hidden="true" />
      <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Eye className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
    </div>

    <h2 className="text-lg font-semibold text-foreground mb-2">
      {area} não está disponível na demonstração
    </h2>
    <p className="text-sm text-muted-foreground max-w-md mb-6">
      Esta área trabalha com os dados da sua conta — não há versão de exemplo.
      Crie uma conta gratuita para usá-la com os seus próprios dados.
    </p>

    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        className="gap-1.5"
        onClick={() => {
          if (onSignUp) onSignUp();
          else window.location.assign("/login");
        }}
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Criar conta gratuita
      </Button>
      {onBack && (
        <Button variant="ghost" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao painel
        </Button>
      )}
    </div>
  </motion.div>
);