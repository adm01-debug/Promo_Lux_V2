import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyReview {
  id: string;
  company_id: string;
  external_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  rating: number | null;
  comment: string | null;
  owner_response: string | null;
  reviewed_at: string | null;
  raw_data: unknown;
  created_at: string;
}

export const useCompanyReviews = (companyId: string | null, pageSize = 10) => {
  return useQuery({
    queryKey: ["company-reviews", companyId, pageSize],
    enabled: !!companyId,
    queryFn: async (): Promise<CompanyReview[]> => {
      const { data, error } = await supabase
        .from("company_reviews")
        .select("*")
        .eq("company_id", companyId!)
        .order("reviewed_at", { ascending: false, nullsFirst: false })
        .limit(pageSize);
      if (error) throw error;
      return (data ?? []) as CompanyReview[];
    },
  });
};
