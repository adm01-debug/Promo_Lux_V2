import { z } from "https://esm.sh/zod@3.23.8";

export const ScrapeJobConfigSchema = z.object({
  keywords: z.array(z.string().min(1).max(200)).min(1).max(20),
  lang: z.string().min(2).max(5).default("pt"),
  zoom: z.number().int().min(1).max(21).default(15),
  lat: z.string().max(30).default("0"),
  lon: z.string().max(30).default("0"),
  fast_mode: z.boolean().default(false),
  radius: z.number().int().min(100).max(100000).default(10000),
  depth: z.number().int().min(1).max(10).default(1),
  email: z.boolean().default(true),
  max_time: z.number().int().positive().default(480000000000),
  proxies: z.array(z.string().max(500)).max(10).default([]),
  extra_reviews: z.boolean().default(false),
  // Campos do contrato omkarcloud/google-maps-scraper. Opcionais: o provedor
  // padrão (gosom) simplesmente os ignora.
  country: z.string().min(2).max(2).optional(),
  business_type: z.string().max(120).optional(),
  max_cities: z.number().int().positive().max(10000).optional(),
  max_results: z.number().int().positive().max(100000).optional(),
  max_reviews: z.number().int().positive().max(500).optional(),
  reviews_sort: z.enum(["newest", "most_relevant", "highest_rating", "lowest_rating"]).optional(),
});


export const CreateScrapeJobSchema = z.object({
  name: z.string().min(1).max(255),
  auto_sync: z.boolean().default(false),
  config: ScrapeJobConfigSchema,
});

export const ScoringCriteriaSchema = z.object({
  sectors: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
});

export const IPCConfigSchema = z.object({
  name: z.string().min(1),
  criteria: ScoringCriteriaSchema,
  is_active: z.boolean().default(false),
});
