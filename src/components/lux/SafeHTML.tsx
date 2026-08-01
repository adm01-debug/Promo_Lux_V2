import { escapeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

interface SafeHTMLProps {
  content: string | null | undefined;
  className?: string;
  as?: "div" | "span" | "p";
}

/**
 * SafeHTML
 * Renderiza conteúdo de texto garantindo que qualquer tag HTML seja escapada
 * para prevenir ataques XSS de dados vindos de fontes externas.
 */
export function SafeHTML({ content, className, as: Component = "div" }: SafeHTMLProps) {
  if (!content) return null;

  // Escapa caracteres perigosos mantendo quebras de linha se existirem
  const sanitized = escapeHtml(content).replace(/\n/g, "<br />");

  return (
    <Component 
      className={cn("whitespace-pre-wrap break-words", className)}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
