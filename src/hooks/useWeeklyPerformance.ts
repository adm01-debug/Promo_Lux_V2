import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_PERFORMANCE } from "@/lib/demoData";

interface DayPerformance {
  day: string;
  raspadas: number;
  qualificadas: number;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function useWeeklyPerformance() {
  const { isDemoMode } = useDemo();

  return useQuery({
    queryKey: ["weekly-performance", isDemoMode],
    queryFn: isDemoMode
      ? () => DEMO_PERFORMANCE
      : async (): Promise<DayPerformance[]> => {
          const now = new Date();
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 6);
          sevenDaysAgo.setHours(0, 0, 0, 0);

          const { data: companies } = await supabase
            .from("companies")
            .select("created_at, ipc_score")
            .gte("created_at", sevenDaysAgo.toISOString())
            .order("created_at", { ascending: true });

          const dayMap = new Map<string, { raspadas: number; qualificadas: number }>();

          for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(sevenDaysAgo.getDate() + i);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            dayMap.set(key, { raspadas: 0, qualificadas: 0 });
          }

          (companies ?? []).forEach((c) => {
            const d = new Date(c.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const entry = dayMap.get(key);
            if (entry) {
              entry.raspadas++;
              if ((c.ipc_score ?? 0) >= 60) entry.qualificadas++;
            }
          });

          const result: DayPerformance[] = [];
          for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(sevenDaysAgo.getDate() + i);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const label = DAY_LABELS[d.getDay()];
            const entry = dayMap.get(key) || { raspadas: 0, qualificadas: 0 };
            result.push({ day: label, ...entry });
          }

          return result;
        },
    staleTime: isDemoMode ? Infinity : 30_000,
  });
}
