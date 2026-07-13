export type ScoreRange = "all" | "90+" | "75-89" | "60-74" | "<60";

export interface FacetItem {
  value: string;
  label: string;
  count: number;
}

export const getScoreRange = (score: number): ScoreRange => {
  if (score >= 90) return "90+";
  if (score >= 75) return "75-89";
  if (score >= 60) return "60-74";
  return "<60";
};

export const getCity = (location: string) => location.split(",")[0].trim();
