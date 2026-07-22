// Tipos compartilhados do módulo Lusha Intelligence.
// Extraídos de LushaIntelligenceView.tsx na Rodada #30 (refactor safety).

export interface DeptGroup {
  label: string;
  items: string[];
}

export interface LushaContact {
  id: string;
  full_name: string;
  job_title: string | null;
  department_pt: string | null;
  linkedin_url: string | null;
  enrichment_status: string | null;
  created_at: string;
  session_id: string | null;
}

export interface LushaSession {
  id: string;
  company_name: string;
  departments_requested: string[] | null;
  departments_mapped: string[] | null;
  total_found: number | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
}

export interface SearchResponse {
  session_id: string;
  company_resolved: string;
  total_found: number;
  departments_searched: string[];
  departments_skipped: string[];
  contacts: LushaContact[];
}

export interface DecisionMaker {
  id: string;
  fullName: string;
  jobTitle: string;
  departments: string[];
  seniority: string;
  company: string;
  location: string;
  linkedin: string;
  hasEmail: boolean;
  hasPhone: boolean;
  emailCredits: number;
  phoneCredits: number;
  linkedinFollowersCount?: number | null;
  linkedinConnectionsCount?: number | null;
  linkedinSkills?: string[];
  linkedinCertifications?: string[];
  linkedinCourses?: string[];
  linkedinAwards?: string[];
  xUrl?: string | null;
}

export interface DMCompanyResult {
  domain: string;
  companyId?: string;
  total?: number;
  error?: string;
  decisionMakers: DecisionMaker[];
}

export interface DMResponse {
  requestId: string;
  creditsCharged: number;
  totalDecisionMakers: number;
  results: DMCompanyResult[];
}
