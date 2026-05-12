import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useIntegracaoPontoFolha() {
  const sincronizar = useMutation({
    mutationFn: async (periodo: { mes: number, ano: number }) => {
      // Simulação de integração com API de folha
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Sincronizando período:", periodo);
      return { success: true, syncedCount: 15 };
    },
    onSuccess: (data) => {
      toast.success(`${data.syncedCount} registros sincronizados com a folha de pagamento.`);
    },
    onError: () => {
      toast.error("Erro na integração com a folha.");
    }
  });

  return {
    sincronizar: sincronizar.mutateAsync,
    isSyncing: sincronizar.isPending
  };
}
