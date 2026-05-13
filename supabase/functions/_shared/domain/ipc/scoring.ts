import { z } from "https://esm.sh/zod@3.23.8";

export interface CompanyData {
  category?: string;
  type?: string;
  address?: string;
  city?: string;
  email?: string;
  phone?: string;
  website?: string;
  web_site?: string;
  rating?: string | number;
}

export interface IPCHittingCriteria {
  sectors?: string[];
  locations?: string[];
}

/**
 * Pure function to calculate IPC score based on company data and criteria.
 * Returns a score between 0 and 100.
 */
export function calculateIPCScore(company: CompanyData, criteria?: IPCHittingCriteria): number {
  let score = 0;
  
  const sector = company.category || company.type;
  const location = company.address || company.city || "";
  
  // 1. Criteria matching (Sectors & Locations)
  if (criteria) {
    if (sector && criteria.sectors?.some(s => sector.toLowerCase().includes(s.toLowerCase()))) {
      score += 30;
    }
    if (location && criteria.locations?.some(loc => location.toLowerCase().includes(loc.toLowerCase()))) {
      score += 20;
    }
  } else {
    // Default baseline if no config
    score = 50;
  }

  // 2. Data Enrichment signals
  if (company.email) score += 15;
  if (company.phone) score += 10;
  if (company.website || company.web_site) score += 10;
  
  // 3. Social Proof / Reputation
  const rating = typeof company.rating === "string" ? parseFloat(company.rating) : (company.rating || 0);
  if (rating >= 4.5) {
    score += 15;
  } else if (rating >= 4.0) {
    score += 10;
  }

  return Math.min(score, 100);
}
