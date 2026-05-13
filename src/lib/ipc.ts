import { IPC_THRESHOLDS } from "./constants";

export interface ScoringCriteria {
  sectors?: string[];
  locations?: string[];
}

export interface ScrapedResult {
  category?: string;
  type?: string;
  city?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  rating?: string | number;
}

/**
 * Calcula o score IPC de uma empresa baseado nos critérios da organização.
 * Função pura e testável.
 */
export function calculateIpcScore(result: ScrapedResult, criteria?: ScoringCriteria | null): number {
  let score = criteria ? 0 : IPC_THRESHOLDS.DEFAULT_BASE_SCORE;

  if (criteria) {
    const sector = result.category || result.type;
    const location = result.city || result.address;

    if (sector && criteria.sectors?.includes(sector)) {
      score += 30;
    }
    
    if (location && criteria.locations?.some(loc => location.includes(loc))) {
      score += 20;
    }
  }

  if (result.email) score += 15;
  if (result.phone) score += 10;
  if (result.website) score += 10;
  
  const rating = typeof result.rating === "string" ? parseFloat(result.rating) : result.rating;
  if (rating && rating >= 4) {
    score += 15;
  }

  return Math.min(score, IPC_THRESHOLDS.MAX_SCORE);
}
