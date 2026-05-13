import { IPC_WEIGHTS, IPC_THRESHOLDS } from "./constants";

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
      score += IPC_WEIGHTS.SECTOR_MATCH;
    }
    
    if (location && criteria.locations?.some(loc => location.includes(loc))) {
      score += IPC_WEIGHTS.LOCATION_MATCH;
    }
  }

  if (result.email) score += IPC_WEIGHTS.HAS_EMAIL;
  if (result.phone) score += IPC_WEIGHTS.HAS_PHONE;
  if (result.website) score += IPC_WEIGHTS.HAS_WEBSITE;
  
  const rating = typeof result.rating === "string" ? parseFloat(result.rating) : result.rating;
  if (rating && rating >= 4) {
    score += IPC_WEIGHTS.HIGH_RATING;
  }

  return Math.min(score, IPC_THRESHOLDS.MAX_SCORE);
}
