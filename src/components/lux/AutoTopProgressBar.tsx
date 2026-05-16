import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TopProgressBar } from "./TopProgressBar";

/**
 * AutoTopProgressBar
 * Monitora globalmente todas as queries e mutações do TanStack Query
 * e exibe o TopProgressBar automaticamente.
 */
export function AutoTopProgressBar() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Ativa se houver qualquer atividade de rede pendente
    if (isFetching > 0 || isMutating > 0) {
      setActive(true);
    } else {
      // Pequeno delay para evitar flashes em respostas instantâneas
      const timer = setTimeout(() => {
        setActive(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isFetching, isMutating]);

  return <TopProgressBar isAnimating={active} />;
}
