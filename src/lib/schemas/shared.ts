import { z } from "zod";

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
});

export const CreateScrapeJobSchema = z.object({
  name: z.string().min(1).max(255),
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
