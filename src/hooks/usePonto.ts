import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/withOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useGeolocation } from "./useGeolocation";

export type PontoTipo = 'entrada' | 'saida' | 'intervalo_inicio' | 'intervalo_fim';

export function usePonto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getPosition } = useGeolocation();

  const { data: registrosHoje, isLoading: loadingRegistros } = useQuery({
    queryKey: ["ponto-registros-hoje", user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await db
        .from("ponto_registros")
        .select("*")
        .gte("timestamp", today.toISOString())
        .order("timestamp", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: config } = useQuery({
    queryKey: ["ponto-config"],
    queryFn: async () => {
      const { data, error } = await db
        .from("ponto_configuracoes")
        .select("*")
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const registrarBatida = useMutation({
    mutationFn: async ({ tipo, observacao }: { tipo: PontoTipo; observacao?: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      let latitude = null;
      let longitude = null;

      if (config?.exige_geolocalizacao) {
        try {
          const coords = await getPosition();
          latitude = coords.latitude;
          longitude = coords.longitude;
        } catch (err) {
          throw new Error("Geolocalização obrigatória não obtida. Verifique as permissões.");
        }
      } else {
        // Tenta obter mas não bloqueia se não for obrigatório
        try {
          const coords = await getPosition();
          latitude = coords.latitude;
          longitude = coords.longitude;
        } catch (e) {
          console.warn("Localização não obtida, mas não é obrigatória.");
        }
      }

      const payload: any = {
        user_id: user.id,
        tipo,
        observacao,
        latitude,
        longitude,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        }
      };

      const { data, error } = await (db.from("ponto_registros" as any) as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-registros-hoje"] });
      toast.success("Ponto registrado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao registrar ponto");
    }
  });

  return {
    registrosHoje,
    loadingRegistros,
    config,
    registrarBatida: registrarBatida.mutateAsync,
    isRegistering: registrarBatida.isPending
  };
}
